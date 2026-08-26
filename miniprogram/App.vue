<script>
// App.vue 是应用级组件：这里的 onLaunch 在 App 启动时执行一次
export default {
  onLaunch() {
    console.log('情绪日历小程序已启动');
  }
};
</script>

<style>
/* 这里的样式是"全局样式"，所有页面都会生效 */
page {
  background-color: #f0f0f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
