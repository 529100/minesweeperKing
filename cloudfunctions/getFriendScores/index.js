const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const db = cloud.database()
  
  // 获取所有用户的成绩
  const allScores = await db.collection('scores')
    .orderBy('time', 'asc')
    .orderBy('timestamp', 'asc')
    .get()

  // 过滤出每个用户的最佳成绩
  const userBest = {}
  allScores.data.forEach(score => {
    const openid = score._openid
    if (!userBest[openid] || score.time < userBest[openid].time) {
      userBest[openid] = score
    }
  })

  // 转换为数组并排序
  const result = Object.values(userBest)
    .sort((a, b) => a.time - b.time || a.timestamp - b.timestamp)
    .slice(0, 100) // 取前100名

  return { data: result }
}