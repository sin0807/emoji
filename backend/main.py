"""本地 Python 后端：和 Netlify / Vercel 函数功能相同的情绪分析接口。

用 FastAPI 写一份等价实现，方便在本地开发和调试：
    pip install -r requirements.txt
    uvicorn main:app --reload

启动后访问 http://127.0.0.1:8000/docs 可以看到自动生成的 API 文档。
"""

import json
import os
import re
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

load_dotenv()  # 读取项目根目录 .env 文件里的 DEEPSEEK_API_KEY

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
MODEL_NAME = "deepseek-chat"
MAX_TEXT_LENGTH = 500

SYSTEM_PROMPT = """你是一个温暖的心理陪伴助手。
用户会用一句话描述自己的心情，你需要：
1. 判断情绪：只允许 happy / normal / sad 三种
2. 用一句 30 字以内、温暖真诚的话回应
只输出一个 JSON 对象，不要输出任何其他内容，不要用 markdown 代码块，格式：
{"mood":"happy 或 normal 或 sad","reply":"你的回应"}"""

app = FastAPI(title="Mood Calendar API", description="AI 情绪分析接口")


class MoodRequest(BaseModel):
    # 字段级校验：为空或超过 500 字时，FastAPI 会直接返回 422，
    # 根本不会进入业务逻辑
    text: str = Field(..., min_length=1, max_length=MAX_TEXT_LENGTH)


class MoodResponse(BaseModel):
    mood: str
    reply: str


def parse_mood_response(content: str) -> Optional[dict]:
    """从模型返回的内容中提取 JSON 并校验，逻辑和 JS 版保持一致。"""
    cleaned = re.sub(r"^```(?:json)?\s*", "", content, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned).strip()

    result = None
    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            try:
                result = json.loads(match.group(0))
            except json.JSONDecodeError:
                result = None

    if not isinstance(result, dict):
        return None

    mood = str(result.get("mood", "")).lower()
    if mood not in {"happy", "normal", "sad"}:
        return None

    return {"mood": mood, "reply": str(result.get("reply", "")).strip()}


@app.get("/")
def read_root():
    return {"status": "ok"}


@app.post("/analyze", response_model=MoodResponse)
async def analyze(request: MoodRequest):
    """输入一句话心情描述，返回情绪分类和温暖的回应。"""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="请输入内容")

    if not DEEPSEEK_API_KEY:
        raise HTTPException(status_code=500, detail="服务端未配置 DEEPSEEK_API_KEY")

    payload = {
        "model": MODEL_NAME,
        "temperature": 0,
        "max_tokens": 120,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f'用户说："{request.text}"'},
        ],
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            DEEPSEEK_URL,
            json=payload,
            headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}"},
        )

    if response.status_code != 200:
        # 同样不要把上游错误原文返回给用户
        raise HTTPException(status_code=502, detail="AI 服务暂时不可用")

    content = response.json()["choices"][0]["message"]["content"].strip()
    result = parse_mood_response(content)
    if result is None:
        raise HTTPException(status_code=502, detail="AI 返回格式不正确")

    return MoodResponse(**result)
