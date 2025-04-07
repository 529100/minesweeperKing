//index.js
//获取应用实例
var app = getApp()
// 在Page配置中添加云数据库引用
const db = wx.cloud.database()
const scoresCollection = db.collection('scores')
Page({

    data: {
        showMainMenu: true,
        mineMap: {},
        timesGo: 0,
        timesRest:0,
        // 新增独立的时间变量
        
        minesLeft: 0,
        // 新增数据项
        gameMode: 'classic',
        timeLimit: 0,

        // 新增数据项
        showRanking: false,
        currentRankTab: 'personal',
        personalScores: [],
        friendScores: [],
        
        // 动画相关数据
        animationData: {},
        cellAnimationData: {},
        showConfetti: false,
        
        // 道具模式相关数据
        items: {
            scanner: 2,
            shield: 1,
            bomb: 1
        },
        activeItem: '',
        itemDescriptions: {
            scanner: '扫描器: 可探测周围区域，显示"?"表示安全区域，"!"表示有地雷',
            shield: '护盾: 保护你免于一次地雷爆炸，将地雷转化为安全格子',
            bomb: '炸弹: 可直接排除一颗地雷，并更新周围的数字'
        },
        scannedCells: {},
        hasShield: false
    },

    // 显示排名界面
    showRanking: function() {
        this.loadPersonalScores();
        this.loadFriendScores();
        this.setData({
            showMainMenu: false,
            showRanking: true
        });
    },
    // 切换排名选项卡
    switchRankTab: function(e) {
        const tab = e.currentTarget.dataset.tab;
        this.setData({ currentRankTab: tab });
    },
     // 加载个人成绩
     loadPersonalScores: function() {
        const scores = wx.getStorageSync('personalScores') || [];
        this.setData({ personalScores: scores.slice(0, 10) });
    },
    // 修改加载好友排名方法
    loadFriendScores: function() {
        const self = this
        wx.cloud.callFunction({
            name: 'getFriendScores',
            success: res => {
                const data = res.result.data
                const currentUser = wx.getStorageSync('openid')
                const formatted = data.map(item => ({
                    name: item.name,
                    bestTime: item.time,
                    isSelf: item._openid === currentUser
            }))
            self.setData({ friendScores: formatted })
        },
        fail: err => {
            console.error('获取好友排名失败:', err)
        }
        })
    },


     // 新增主菜单模式选择
    selectMode: function(e) {
        const mode = e.currentTarget.dataset.mode;
        // 先设置游戏模式
        this.setData({
            gameMode: mode
        });
        
        // 然后隐藏主菜单，优先显示游戏界面
        setTimeout(() => {
            this.setData({
            showMainMenu: false
        });
        this.setGame();
        }, 100); // 增加短暂延迟确保状态更新完成
    },
     // 改进模式切换处理
     switchMode: function(e) {
        const mode = e.currentTarget.dataset.mode;
        const previousMode = this.data.gameMode;
        
        // 如果是道具模式，不允许从界面切换
        if (previousMode === 'special') {
            wx.showToast({
                title: '道具模式下无法切换',
                icon: 'none',
                duration: 1500
            });
            return;
        }
        
        // 更新游戏模式
        this.setData({
            gameMode: mode
        });
        
        // 停止当前计时
        this.timeGoStop();
        
        // 如果从经典模式切换到限时模式，不立即重启游戏，让用户输入时间
        if (previousMode === 'classic' && mode === 'timeChallenge') {
            this.drawMineField();
            this.setData({
                buttionText: 'START',
                timesGo: 0,
                timesRest: 0,
                timeLimit: 0
            });
        } 
        // 如果从限时模式切换到经典模式，重置并立即重启游戏
        else if (previousMode === 'timeChallenge' && mode === 'classic') {
            this.setGame();
        }
        // 在同一模式下点击，重启游戏
        else {
            this.setGame();
        }
    },
    // 修改时间限制输入处理，让用户输入时间后立即开始游戏
    setTimeLimit: function(e) {
        const value = parseInt(e.detail.value) || 0;
        
        // 更新时间限制值
        this.setData({
            timeLimit: value
        });
        
        // 验证时间输入
        if (value > 0) {
            // 如果时间有效，立即开始游戏
            this.setData({
                timesRest: value // 设置倒计时时间
            });
            
            // 如果游戏尚未开始（显示START按钮），则自动开始游戏
            if (this.data.buttionText === 'START') {
                this.setGame();
            } else {
                // 如果游戏已开始，则重新开始
                this.timeGoStop(); // 停止当前计时
                this.setGame();
            }
        }
    },
    mineMap: {},
    mineMapMapping: {},
    rowCount: 8,
    colCount: 8,
    mineCount: 8,
    minMineCount: 8,
    maxMineCount: 10,//最大雷数量
    minesLeft: 0,
    
    timeInterval: null,
    flagOn: false,
    flags: 0,
    endOfTheGame: false,
    safeMinesGo: 0,

    onLoad: function() {
        // 创建动画实例
        this.cellAnimation = wx.createAnimation({
            duration: 200,
            timingFunction: 'ease',
        });
        
        this.menuAnimation = wx.createAnimation({
            duration: 500,
            timingFunction: 'ease-out',
        });

        // 设置初始状态
        this.setData({
            showMainMenu: true,
            minesLeft: 0,
            timesRest: 0,
            timesGo: 0,
            buttionText: 'START'
        });
        
        // 初始化空白雷区并设置单元格动画数组
        var tmpMineMap = {};
        var tmpCellAnimation = {};
        
        for (var row = 0; row < this.rowCount; row++) {
            tmpMineMap[row] = [];
            tmpCellAnimation[row] = [];
            
            for (var col = 0; col < this.colCount; col++) {
                tmpMineMap[row][col] = -1;
                tmpCellAnimation[row][col] = null;
            }
        }
        
        this.mineMap = tmpMineMap;
        
        this.setData({
            mineMap: this.mineMap,
            cellAnimation: tmpCellAnimation
        });
        
        // 页面加载时的标题动画
        this.animateTitle();
    },
    
    // 添加标题动画
    animateTitle: function() {
        const animation = wx.createAnimation({
            duration: 2000,
            timingFunction: 'ease-out',
        });
        
        // 创建更简单的动画序列
        animation.opacity(0).scale(0.5).step({ duration: 0 });
        animation.opacity(1).scale(1).step();
        
        this.setData({
            animationData: animation.export()
        });
        
        // 添加粒子动画
        this.animateParticles();
        
        // 延迟添加地雷旋转动画
        setTimeout(() => {
            this.animateMine();
        }, 800);
        
        // 按钮入场动画
        this.animateButtons();
    },

    // 添加粒子动画
    animateParticles: function() {
        // 动态创建12个粒子
        const particles = [];
        for (let i = 0; i < 12; i++) {
            particles.push({
                id: i + 1,
                active: true
            });
        }
        
        this.setData({
            particles: particles
        });
    },

    // 添加地雷旋转的额外动画效果
    animateMine: function() {
        const mineAnimation = wx.createAnimation({
            duration: 800,
            timingFunction: 'ease-out'
        });
        
        // 创建更复杂的动画序列
        mineAnimation.scale(1.4).rotate(45).step({ duration: 200 });
        mineAnimation.scale(0.8).rotate(-30).step({ duration: 200 });
        mineAnimation.scale(1.2).rotate(15).step({ duration: 200 });
        mineAnimation.scale(1).rotate(0).step({ duration: 200 });
        
        this.setData({
            mineAnimationData: mineAnimation.export()
        });
        
        // 添加振动效果
        if (wx.vibrateShort) {
            wx.vibrateShort({
                type: 'medium'
            });
        }
    },

    // 添加按钮入场动画
    animateButtons: function() {
        const buttons = ['classic', 'time', 'special', 'rank'];
        
        buttons.forEach((btn, index) => {
            setTimeout(() => {
                const animation = wx.createAnimation({
                    duration: 600,
                    timingFunction: 'ease-out'
                });
                
                // 简化动画以避免不必要的复杂性
                animation.opacity(0).scale(0.8).step({ duration: 0 });
                animation.opacity(1).scale(1).step();
                
                // 使用数组索引语法更新
                let buttonAnimation = {};
                buttonAnimation[`${btn}BtnAnimation`] = animation.export();
                
                this.setData(buttonAnimation);
            }, 1000 + index * 200);
        });
    },

    // 修改返回主菜单方法，增加更好的转场过渡
    backToMainMenu: function() {
        this.timeGoStop();  // 停止计时
        
        // 先重置游戏状态
        this.endOfTheGame = true;
        this.mineMapMapping = {};
        this.mineCount = 8;
        this.safeMinesGo = 0;
        this.flagOn = false;
        
        // 清理道具模式的状态
        if (this.data.gameMode === 'special') {
            this.setData({
                activeItem: '',
                scannedCells: {},
                hasShield: false
            });
        }
        
        // 使用延迟来确保顺利切换
        setTimeout(() => {
        this.setData({
            showMainMenu: true,
            showRanking: false,
            mineMap: {},
            timesGo: 0,
            timesRest: 0,
            minesLeft: 0,
            timeLimit: 0,
            buttionText: 'START'
        });
            
        // 重新绘制空白雷区
        this.drawMineField();
            
            // 重新运行菜单动画
            this.animateTitle();
        }, 100);
    },
    setGame: function() {
        // 隐藏主菜单（如果还在显示）
        if (this.data.showMainMenu) {
            this.setData({ 
                showMainMenu: false,
                // 重置时间显示
                timesGo: 0,
                timesRest: this.data.gameMode === 'timeChallenge' ? this.data.timeLimit : 0
            });
        this.drawMineField();
            this.setData({
                buttionText: 'START'
            });
            
            // 如果是限时模式且已经输入了有效时间，则自动开始游戏
            if (this.data.gameMode === 'timeChallenge' && this.data.timeLimit > 0) {
                // 短暂延迟确保界面先渲染完成
                setTimeout(() => {
                    this.startGame();
                }, 100);
            }
        return;
    }
        
        // 已经在游戏界面，直接开始游戏
        this.startGame();
    },
    // 新增方法：实际开始游戏逻辑
    startGame: function() {
        // 严格验证时间输入
        if (this.data.gameMode === 'timeChallenge') {
            const validTime = Number.isInteger(this.data.timeLimit) && this.data.timeLimit > 0;
            if (!validTime) {
                wx.showToast({ 
                title: '时间需≥1秒', 
                icon: 'none',
                duration: 2000 
                });
                return;
            }
        }
        
        // 重置游戏状态和变量
        this.safeMinesGo = 0;
        this.endOfTheGame = false;
        this.flagOn = false;
        this.mineMapMapping = {};
        
        // 道具模式相关状态重置
        if (this.data.gameMode === 'special') {
            this.setData({
                items: {
                    scanner: 2,
                    shield: 1,
                    bomb: 1
                },
                activeItem: '',
                scannedCells: {},
                hasShield: false
            });
        }
        
        // 绘制雷区和初始化游戏
        this.drawMineField();
        this.createMinesMap();
        this.setMinesLeft();
        this.timeGoReset();
        this.timeGoClock();
        
        // 确保所有单元格大小一致
        setTimeout(() => {
            this.setData({
                buttionText: 'RESTART',
                // 刷新布局
                mineMap: this.mineMap
            });
        }, 50);
    },
    // 增强输入处理
    handleTimeInput: function(e) {
        const rawValue = e.detail.value;
        // 严格数字校验
        const parsedValue = parseInt(rawValue.replace(/[^0-9]/g, ''));
        const clampedValue = Math.min(Math.max(parsedValue || 0, 1), 999);  // 限制1-999秒
    
        this.setData({ 
            timeLimit: isNaN(clampedValue) ? 0 : clampedValue 
        });
    },

    setMinesLeft: function() {
        this.minesLeft = this.mineCount;
        this.setData({minesLeft: this.minesLeft});
    },

    // 修改计时器逻辑
    timeGoClock: function() {
        var self = this;
        if (this.data.gameMode === 'timeChallenge') {
            // 倒计时模式
            this.timeInterval = setInterval(() => {
                self.timesGo++;
                self.setData({ timesGo: self.timesGo });
                if (self.timesRest > 0) {
                    self.timesRest--;
                    self.setData({ timesRest: self.timesRest });
                    if (self.timesRest === 0) {
                        this.timeUpFailure();
                    }
                }
            }, 1000);
        } else {
            // 经典模式原逻辑
            this.timeInterval = setInterval(() => {
                self.timesGo++;
                self.setData({ timesGo: self.timesGo });
            }, 1000);
        }
    },
    // 新增超时失败处理
    timeUpFailure: function() {
        wx.showToast({
            title: '时间到！',
            image: '../images/icon/emoticon_sad.png',
            duration: 2000
        });
        this.showAll();
        this.timeGoStop();
        this.endOfTheGame = true;
    },
    
    timeGoStop: function() {
    
        clearInterval(this.timeInterval);
    },

    // 修改时间重置方法
    timeGoReset: function() {
        clearInterval(this.timeInterval);
        // 根据模式设置初始时间
        if (this.data.gameMode === 'timeChallenge') {
            this.timesRest = this.data.timeLimit;
            this.timesGo = 0;
            this.setData({ 
                timesGo: this.timesGo,
                timesRest: this.timesRest
            });
        } else {
            this.timesGo = 0;
        this.setData({ timesGo: this.timesGo });
        }
    },

    createMinesMap: function() {

        var tmpMineMap = {};
        // initalize mine map with 0.
        for (var row = 0; row < this.rowCount; row++) {

            tmpMineMap[row] = [];
            for (var col = 0; col < this.colCount; col++) {

                tmpMineMap[row][col] = 0;
            }
        }
         //console.log(tmpMineMap);
        
        // laying mines with 9
        this.mineCount = this.rangeRandom(this.minMineCount, this.maxMineCount);

        var tmpCount = this.mineCount;
        //console.log("Mine count: ", tmpCount);
        while (tmpCount > 0) {

            var row = this.rangeRandom(0, this.rowCount - 1);
            var col = this.rangeRandom(0, this.colCount - 1);

            if (tmpMineMap[row][col] != 9) {

                tmpMineMap[row][col] = 9;
                tmpCount--;
            }
        }

        // calculate numbers around mines.
        for (var row = 0; row < this.rowCount; row++) {
            for (var col = 0; col < this.colCount; col++) {
                var startRow = row - 1;
                var startCol = col - 1;
                //console.log("check====== r" +startRow +"c"+startCol );
                for (var r = row-1; r < row+2; r++) {
                    for (var c = col-1; c < col+2; c++) {
                        //console.log("go: r"+r+":c"+c);
                        if (c >= 0 && c < this.colCount
                            && r >= 0 && r < this.rowCount
                        && !(r === row && c === col) 
                        && tmpMineMap[r][c] == 9 
                        && tmpMineMap[row][col] != 9) {
                            tmpMineMap[row][col]++;
                        }
                    }
                }
            }
        }
        this.mineMapMapping = tmpMineMap;
    },

    drawMineField: function() {
        // 确保在每次重绘时重置单元格动画数据
        var tmpMineMap = {};
        var tmpCellAnimation = {};

        for (var row = 0; row < this.rowCount; row++) {
            tmpMineMap[row] = [];
            tmpCellAnimation[row] = [];

            for (var col = 0; col < this.colCount; col++) {
                tmpMineMap[row][col] = -1;
                tmpCellAnimation[row][col] = null;
            }
        }
        
        this.mineMap = tmpMineMap;

        this.setData({
            mineMap: this.mineMap,
            cellAnimation: tmpCellAnimation // 重置所有单元格的动画状态
        });
    },

    demining: function(event) {
        if (this.endOfTheGame)
            return;

        var x = parseInt(event.target.dataset.x);
        var y = parseInt(event.target.dataset.y);
        var value = parseInt(event.target.dataset.value);
        
        // 添加动画调用
        this.animateCell(x, y);
        
        if (JSON.stringify(this.mineMapMapping) == "{}") return;

        //flag this field as mine.
        if (this.flagOn) {
            this.flag(x, y, value);
            return;
        }

        // 道具模式下，尝试使用道具
        if (this.data.gameMode === 'special' && this.data.activeItem) {
            // 使用道具并返回成功与否
            const itemUsed = this.useItem(x, y);
            if (itemUsed) return; // 如果成功使用道具，不继续执行普通点击
        }
        
        //prevent clicking on flagged items.
        if (value > 9) {
            return;
        }

        //first click or safe click
        if (this.mineMapMapping[x][y] == 9) {
            this.gameOver(x, y);
        } else {//empty cell or number
            var count = this.dig(x, y);
            
            if (count == this.rowCount * this.colCount - this.mineCount)
                this.gameWin();
        }
    },

    success: function() {
        wx.showToast({
            title: 'Good Job !',
            image: '../images/icon/emoticon_happy.png',
            duration: 3000
        })
        this.timeGoStop();
        this.endOfTheGame = true;

        // 保存成绩
        if (this.data.gameMode === 'classic' || this.data.gameMode === 'timeChallenge') {
            this.saveScore(this.timesGo);
        }

        // 添加胜利动画
        this.showWinAnimation();
    },

    failed: function(x, y) {
        wx.showToast({
            title: 'Bomb !!!',
            image: '../images/icon/emoticon_sad.png',
            mask: true,
            duration: 3000
        })

        this.showAll(x, y);
        this.timeGoStop();
        this.endOfTheGame = true;
    },

    // 在Page对象中添加以下方法
showUploadDialog: function() {
    const scores = wx.getStorageSync('personalScores') || [];
    if (scores.length === 0) {
        wx.showToast({
            title: '暂无可上传的成绩',
            icon: 'none'
        });
        return;
    }
    
    const bestScore = scores.reduce((prev, current) => 
        (prev.time < current.time) ? prev : current
    );
    
    const self = this;
    wx.showModal({
        title: '上传最佳成绩',
        content: `当前最佳成绩：${bestScore.time}秒`,
        editable: true,
        placeholderText: '输入展示名称（2-10字）',
        success(res) {
            if (res.confirm) {
                const name = res.content.substring(0, 10).trim();
                if (name.length < 2) {
                    wx.showToast({
                        title: '名称至少2个字',
                        icon: 'none'
                    });
                    return;
                }
                self.uploadScore(name, bestScore.time);
            }
        }
    });
},

// 修改后的上传方法
uploadScore: function(name, time) {
    scoresCollection.add({
        data: {
            name: name,
            time: time,
            timestamp: db.serverDate(),
            openid: wx.getStorageSync('openid')
        },
        success: () => {
            wx.showToast({ title: '上传成功', icon: 'success' });
            this.loadFriendScores();
            // 更新本地记录为已上传状态（可选）
            let scores = wx.getStorageSync('personalScores') || [];
            scores = scores.map(score => {
                if (score.time === time) {
                    score.uploaded = true;
                }
                return score;
            });
            wx.setStorageSync('personalScores', scores);
        },
        fail: (err) => {
            console.error('上传失败:', err);
            wx.showToast({ title: '上传失败', icon: 'none' });
        }
    });
},


   

    // 修改后的保存方法
saveScore: function(time) {
    const newScore = {
        time: time,
        date: this.formatDate(new Date()),
        uploaded: false // 添加上传状态标识
    };
    
    let scores = wx.getStorageSync('personalScores') || [];
    scores.push(newScore);
    scores.sort((a, b) => a.time - b.time);
    scores = scores.slice(0, 10);
    
    wx.setStorageSync('personalScores', scores);
    this.loadPersonalScores();
},

    // 日期格式化
    formatDate: function(date) {
        return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
    },

    // Open the fields arround 0 field recursively.
    openZeroArround: function(row, col) {
        //console.log("click" + row + " " + col)
        for (var r = (row-1); r < (row+2); r++) {
            for (var c = (col-1); c < (col+2); c++) {
                //console.log("go: r"+r+":c"+c);
                if (r >= 0 && r < this.rowCount
                    && c >= 0 && c < this.colCount
                && !(r === row && c === col) 
                && this.mineMap[r][c] < 0) {

                    this.mineMap[r][c] = this.mineMapMapping[r][c];
                    this.safeMinesGo++;

                    if (this.mineMapMapping[r][c] == 0) {
                        this.openZeroArround(r, c);
                    }

                }
            }
        }
        console.log("Safe mine go: " + this.safeMinesGo);
        if ((this.safeMinesGo + this.mineCount) == (this.rowCount * this.colCount)) {
            this.success();
        }

    },

    flagSwitch: function(e) {

        if (e.detail.value) {

            this.flagOn = true;
        } else {

            this.flagOn = false;
        }
    },

    flag: function(x, y, value) {

        if (value > 0 && value < 10) return;

        // if flaged already, set the original state.
        if (value == 10) {

            this.pullUpFlag(x, y);
            return;
        }

        if (this.minesLeft <= 0) return;

        this.minesLeft = this.minesLeft - 1;
        this.mineMap[x][y] = 10;

        this.setData({mineMap: this.mineMap, minesLeft: this.minesLeft});
    },

    pullUpFlag: function(x, y) {

        if (this.minesLeft < this.mineCount) {
            this.minesLeft = this.minesLeft + 1;
        }
        this.mineMap[x][y] = -1;
        this.setData({mineMap: this.mineMap, minesLeft: this.minesLeft});
    },

    rangeRandom: function(x, y) {
        var z = y - x + 1;
        return Math.floor(Math.random() * z + x);
    }, 

    showAll: function(x, y) {
        // 复制原始雷区映射，并标记触发位置为 19
    var tmpMap = {};
    for (var row = 0; row < this.rowCount; row++) {
        tmpMap[row] = [];
        for (var col = 0; col < this.colCount; col++) {
            // 如果是触发位置且是地雷，设为 19
            if (row === x && col === y && this.mineMapMapping[row][col] === 9) {
                tmpMap[row][col] = 19;
            } else {
                tmpMap[row][col] = this.mineMapMapping[row][col];
            }
        }
    }
        this.mineMap = tmpMap;
        this.setData({mineMap: this.mineMap});
    },

    // 添加单元格动画
    animateCell: function(x, y) {
        this.cellAnimation.scale(0.8).step().scale(1).step();
        
        // 使用数组索引语法更新特定单元格的动画数据
        let cellAnimation = {};
        cellAnimation[`cellAnimation[${x}][${y}]`] = this.cellAnimation.export();
        
        this.setData(cellAnimation);
    },

    // 游戏胜利时显示动画特效
    showWinAnimation: function() {
        // 显示五彩纸屑特效
        this.setData({
            showConfetti: true
        });
        
        // 3秒后隐藏特效
        setTimeout(() => {
            this.setData({
                showConfetti: false
            });
        }, 3000);
    },

    // 游戏结束处理
    gameOver: function(x, y) {
        // 道具模式护盾检查
        if (this.data.gameMode === 'special' && this.data.hasShield) {
            this.useShieldEffect(x, y);
            return;
        }

        // 显示踩到的地雷
        this.mineMap[x][y] = 19; // 使用特殊值19表示爆炸的地雷
        this.setData({mineMap: this.mineMap});
        
        // 调用原有的失败方法
        this.failed(x, y);
    },
    
    // 游戏胜利处理
    gameWin: function() {
        // 调用原有的成功方法
        this.success();
    },

    // Add the missing dig function 
    dig: function(row, col) {
        if (this.mineMap[row][col] >= 0) return this.safeMinesGo;
        
        this.mineMap[row][col] = this.mineMapMapping[row][col];
        this.safeMinesGo++;

        // If a cell with 0 is opened, open all adjacent cells
        if (this.mineMapMapping[row][col] == 0) {
            this.openZeroArround(row, col);
        }

        this.setData({mineMap: this.mineMap});
        return this.safeMinesGo;
    },

    // 选择道具方法
    selectItem: function(e) {
        const item = e.currentTarget.dataset.item;
        
        // 如果已经选择了此道具，则取消选择
        if (this.data.activeItem === item) {
            this.setData({
                activeItem: ''
            });
            return;
        }
        
        // 检查道具数量
        if (this.data.items[item] <= 0) {
            wx.showToast({
                title: '道具不足',
                icon: 'none',
                duration: 1500
            });
            return;
        }
        
        this.setData({
            activeItem: item
        });
    },

    // 使用道具
    useItem: function(x, y) {
        const activeItem = this.data.activeItem;
        if (!activeItem || this.data.items[activeItem] <= 0) return false;
        
        // 减少道具数量
        const items = this.data.items;
        items[activeItem]--;
        
        switch(activeItem) {
            case 'scanner':
                this.useScanner(x, y);
                break;
            case 'shield':
                this.useShield();
                break;
            case 'bomb':
                this.useBomb(x, y);
                break;
        }
        
        // 更新道具数据
        this.setData({
            items: items,
            activeItem: ''  // 使用后清除激活状态
        });
        
        return true;
    },

    // 使用扫描器
    useScanner: function(x, y) {
        const scanRange = 1;  // 扫描范围
        const scannedCells = {};
        
        // 扫描周围格子
        for (let i = Math.max(0, x - scanRange); i <= Math.min(this.rowCount - 1, x + scanRange); i++) {
            for (let j = Math.max(0, y - scanRange); j <= Math.min(this.colCount - 1, y + scanRange); j++) {
                // 跳过已打开的格子
                if (this.mineMap[i][j] >= 0 && this.mineMap[i][j] < 9) continue;
                
                // 标记为已扫描
                const key = i + '-' + j;
                scannedCells[key] = true;
            }
        }
        
        // 设置扫描结果并将地图数据传递给模板
        this.setData({
            scannedCells: scannedCells,
            mineMapMapping: this.mineMapMapping // 重要：确保地图数据可在模板中使用
        });
        
        // 显示提示
        wx.showToast({
            title: '已扫描周围区域',
            icon: 'success',
            duration: 1500
        });
        
        // 5秒后清除扫描效果
        setTimeout(() => {
            this.setData({
                scannedCells: {}
            });
        }, 5000);
    },

    // 使用护盾
    useShield: function() {
        this.setData({
            hasShield: true
        });
        
        wx.showToast({
            title: '护盾已激活',
            icon: 'success',
            duration: 1500
        });
    },

    // 护盾效果
    useShieldEffect: function(x, y) {
        // 消耗护盾
        this.setData({
            hasShield: false
        });
        
        // 显示提示
        wx.showToast({
            title: '护盾保护了你！',
            icon: 'success',
            duration: 1500
        });
        
        // 打开当前格子（将地雷转为普通格子）
        this.mineMap[x][y] = 0;
        this.mineMapMapping[x][y] = 0;
        
        // 更新周围数字
        this.updateSurroundingNumbers(x, y);
        
        // 更新地雷数量
        this.minesLeft--;
        this.setData({
            mineMap: this.mineMap,
            minesLeft: this.minesLeft
        });
    },

    // 使用炸弹
    useBomb: function(x, y) {
        // 如果当前位置是地雷，直接清除
        if (this.mineMapMapping[x][y] === 9) {
            this.mineMap[x][y] = 0;  // 清除地雷
            this.mineMapMapping[x][y] = 0;  // 更新地图
            
            // 更新周围数字
            this.updateSurroundingNumbers(x, y);
            
            // 更新地雷数量
            this.minesLeft--;
            this.setData({
                mineMap: this.mineMap,
                minesLeft: this.minesLeft
            });
            
            wx.showToast({
                title: '成功排除一颗地雷！',
                icon: 'success',
                duration: 1500
            });
        } else {
            wx.showToast({
                title: '此处没有地雷',
                icon: 'none',
                duration: 1500
            });
        }
    },

    // 更新周围数字
    updateSurroundingNumbers: function(x, y) {
        for (let i = Math.max(0, x - 1); i <= Math.min(this.rowCount - 1, x + 1); i++) {
            for (let j = Math.max(0, y - 1); j <= Math.min(this.colCount - 1, y + 1); j++) {
                // 跳过当前位置和地雷
                if ((i === x && j === y) || this.mineMapMapping[i][j] === 9) continue;
                
                // 减少周围的数字
                if (this.mineMapMapping[i][j] > 0) {
                    this.mineMapMapping[i][j]--;
                    
                    // 如果格子已经打开，更新显示
                    if (this.mineMap[i][j] >= 0 && this.mineMap[i][j] < 9) {
                        this.mineMap[i][j] = this.mineMapMapping[i][j];
                    }
                }
            }
        }
    },

    // 限时模式时间输入相关逻辑
    timeInputVisible: function() {
        // 只有在限时模式下才显示时间输入框，道具模式下不显示
        return this.data.gameMode === 'timeChallenge';
    },

});



