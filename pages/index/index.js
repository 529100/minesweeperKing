//index.js
//获取应用实例
var app = getApp()

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
        friendScores: []
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
    // 加载好友成绩（示例数据）
    loadFriendScores: function() {
        // 实际应调用微信API获取好友数据，此处用模拟数据
        const mockData = [
            { name: "玩家1", bestTime: 45, isSelf: false },
            { name: "小明", bestTime: 62, isSelf: false },
            { name: "我的成绩", bestTime: 58, isSelf: true }
        ].sort((a, b) => a.bestTime - b.bestTime);
        
        this.setData({ friendScores: mockData });
    },


     // 新增主菜单模式选择
    selectMode: function(e) {
        const mode = e.currentTarget.dataset.mode;
        this.setData({
            gameMode: mode,
            showMainMenu: false
        });
        this.setGame();
    },
     // 新增模式切换处理
     switchMode: function(e) {
        const mode = e.currentTarget.dataset.mode;
        this.setData({
            gameMode: mode
        });
        this.setGame(); // 切换模式时重置游戏
    },
    // 新增时间限制输入处理
    setTimeLimit: function(e) {
        this.setData({
            timeLimit: parseInt(e.detail.value) || 0
        });
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

        this.setData({
            showMainMenu: true,
            minesLeft: 0,
            timesRest: 0,
            timesGo: 0
        });
        this.drawMineField();
        this.setData({
            buttionText: 'START'
        })

    },
    // 新增返回主菜单方法
    backToMainMenu: function() {
        this.timeGoStop();  // 停止计时
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
        // 重置内部游戏状态
        this.endOfTheGame = true;
        this.mineMapMapping = {};
        this.mineCount = 8;
        this.safeMinesGo = 0;
        this.flagOn = false;
        // 重新绘制空白雷区
        this.drawMineField();
    },
    setGame: function() {
        // 当从主菜单进入时只初始化界面，不自动开始
        if (this.data.showMainMenu) {
            this.setData({ 
                showMainMenu: false,
                // 重置时间显示
                timesGo: 0,
                timesRest: this.data.gameMode === 'timeChallenge' ? 0 : undefined
            });
        this.drawMineField();
        return;
    }
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
        

        this.drawMineField();
        this.createMinesMap();
        this.setMinesLeft();
        this.timeGoReset();
        this.timeGoClock();
        this.endOfTheGame = false;
        this.safeMinesGo = 0;
        this.setData({
            buttionText: 'RESTART'
        })

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
        } else {
            this.timesGo = 0;
        }
        this.setData({ timesGo: this.timesGo });
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

        var tmpMineMap = {};
        for (var row = 0; row < this.rowCount; row++) {

            tmpMineMap[row] = [];
            for (var col = 0; col < this.colCount; col++) {

                tmpMineMap[row][col] = -1;
            }
        }
        this.mineMap = tmpMineMap;
        //console.log(this.mineMap);

        this.setData({
            mineMap: this.mineMap 
        })

    },

    demining: function(event) {

        if (JSON.stringify(this.mineMapMapping) == "{}") return;


        var x = parseInt(event.target.dataset.x);
        var y = parseInt(event.target.dataset.y);
        var value = parseInt(event.target.dataset.value);
        //console.log("value:" + value +" x:"+x +" y:"+y);

        //flag this field as mine.
        if (this.flagOn) {

            this.flag(x, y, value);
            return;
        }

        // if field has been opened, return.
        if (value > 0) return;
        
        var valueMapping = this.mineMapMapping[x][y];
        //console.log(this.mineMapMapping);
        //console.log(valueMapping);

        if (valueMapping < 9) {
            this.mineMap[x][y] = valueMapping;
            this.setData({mineMap: this.mineMap});
            this.safeMinesGo++;
            console.log("Safe mine go: " + this.safeMinesGo);
            if ((this.safeMinesGo + this.mineCount) == (this.rowCount * this.colCount)) {
                this.success();
            }
        }

        // When digg the mine.
        if (valueMapping == 9) {
            this.failed();
        }

        // Open the fields with 0 mines arround.
        if (valueMapping == 0) {

            this.openZeroArround(x, y);
            this.setData({mineMap:this.mineMap});
        }
        // 当踩到地雷时，传递坐标给 failed()
        if (valueMapping == 9) {
            this.failed(x, y);  // 新增参数 x, y
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

    // 保存个人成绩
    saveScore: function(time) {
        const newScore = {
            time: time,
            date: this.formatDate(new Date())
        };
        
        let scores = wx.getStorageSync('personalScores') || [];
        scores.push(newScore);
        // 按时间排序并保留前10
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
    }

});



