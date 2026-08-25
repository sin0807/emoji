"""本地 Python 后端：和 Netlify / Vercel 函数功能相同的情绪分析接口。

用 FastAPI 写一份等价实现，方便在本地开发和调试：
    pip install -r requirements.txt
    uvicorn main:app --reload

启动后访问 http://127.0.0.1:8000/docs 可以看到自动生成的 API 文档。
"""

import asyncio
import json
import os
import re
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

load_dotenv()  # 读取项目根目录 .env 文件里的环境变量

# ---- 多模型配置表 ----
# DeepSeek / 通义千问 / 豆包都兼容 OpenAI 的 Chat Completions 接口格式，
# 只需要维护"地址 / 密钥环境变量名 / 默认模型名"，靠环境变量切换服务商。
PROVIDERS = {
    "deepseek": {
        "url": "https://api.deepseek.com/v1/chat/completions",
        "key_env": "DEEPSEEK_API_KEY",
        "default_model": "deepseek-chat",
    },
    "qwen": {
        "url": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        "key_env": "DASHSCOPE_API_KEY",
        "default_model": "qwen-plus",
    },
    "doubao": {
        "url": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
        "key_env": "ARK_API_KEY",
        "default_model": "doubao-seed-1-6-250615",
    },
}
MAX_TEXT_LENGTH = 500


def get_model_config() -> dict:
    """根据环境变量选择当前模型服务商，返回配置或错误信息。"""
    provider = os.getenv("MODEL_PROVIDER", "deepseek").lower()
    p = PROVIDERS.get(provider)
    if p is None:
        return {"error": f"未知的 MODEL_PROVIDER: {provider}（可选 deepseek / qwen / doubao）"}
    api_key = os.getenv(p["key_env"])
    if not api_key:
        return {"error": f"当前模型 {provider} 缺少环境变量 {p['key_env']}"}
    return {
        "provider": provider,
        "url": p["url"],
        "api_key": api_key,
        "model": os.getenv("MODEL_NAME") or p["default_model"],
        "json_mode": os.getenv("MODEL_JSON_MODE", "1") != "0",
    }

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
    model: Optional[str] = None


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

    cfg = get_model_config()
    if cfg.get("error"):
        raise HTTPException(status_code=500, detail=cfg["error"])

    payload = {
        "model": cfg["model"],
        "temperature": 0,
        "max_tokens": 120,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f'用户说："{request.text}"'},
        ],
    }
    if cfg["json_mode"]:
        payload["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=30) as client:
        # 上游 429（限流）或 5xx（服务器错误）时自动重试，最多 3 次，等待时间翻倍
        response = None
        for attempt in range(3):
            response = await client.post(
                cfg["url"],
                json=payload,
                headers={"Authorization": f"Bearer {cfg['api_key']}"},
            )
            retryable = response.status_code == 429 or response.status_code >= 500
            if not retryable or attempt == 2:
                break
            await asyncio.sleep(0.5 * (2 ** attempt))

    if response.status_code != 200:
        # 同样不要把上游错误原文返回给用户
        raise HTTPException(status_code=502, detail="AI 服务暂时不可用")

    content = response.json()["choices"][0]["message"]["content"].strip()
    result = parse_mood_response(content)
    if result is None:
        raise HTTPException(status_code=502, detail="AI 返回格式不正确")

    return MoodResponse(**result, model=cfg["model"])
