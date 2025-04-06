//app.js
App({
    onLaunch: function () {
      wx.cloud.init({
        env: 'cloud1-0g4hyk71348512e3', // 替换为你的云环境ID
        traceUser: true
      })
    }
  })