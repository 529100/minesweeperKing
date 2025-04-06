//app.js
App({
    onLaunch: function () {
      wx.cloud.init({
        env: 'cloud1-7gejg5hw96d66783', // 替换为你的云环境ID
        traceUser: true
      })
    }
  })