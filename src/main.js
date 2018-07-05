const electron = require('electron');
var fs = require('fs');

const ipc = electron.ipcMain;
const shell = electron.shell;

const url = require('url');
const path = require('path');
const sqlite = require('sqlite3').verbose();

const {app, BrowserWindow, Menu, protocol} = electron;

app.disableHardwareAcceleration();

var dbFlag = false;
var stateTableCreated = false;
var mainWindow;

//Create Data directory and initialize the Database there
fs.mkdir(app.getPath('home') + '/\.TuDu',function() {

  var dbPath = app.getPath('home') + '/\.TuDu/Data.db';

  // Create the Database and tables
  global.db = new sqlite.Database(dbPath, function(err) {
    if(err == null){
      db.serialize(function() {
        db.run("CREATE TABLE IF NOT EXISTS CATEGORY ( id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, type TEXT NOT NULL )",function(err) {});
        db.run("CREATE TABLE IF NOT EXISTS TASK ( id INTEGER PRIMARY KEY AUTOINCREMENT, task TEXT NOT NULL, state INTEGER NOT NULL, category INTEGER, FOREIGN KEY(category) REFERENCES CATEGORY(id) ON UPDATE CASCADE ON DELETE CASCADE )",function(err) {});
        // db.run("CREATE TABLE IF NOT EXISTS LAST_SELECTED_CATEGORY( id INTEGER PRIMARY KEY AUTOINCREMENT, category INTEGER NOT NULL, FOREIGN KEY(category) REFERENCES CATEGORY(id) ON UPDATE CASCADE ON DELETE CASCADE )",function(err) {
        db.run("CREATE TABLE IF NOT EXISTS LAST_SELECTED_CATEGORY( id INTEGER PRIMARY KEY AUTOINCREMENT, category INTEGER NOT NULL, type TEXT NOT NULL, FOREIGN KEY(category) REFERENCES CATEGORY(id) ON UPDATE CASCADE ON DELETE CASCADE )",function(err) {});
        db.run("CREATE TABLE IF NOT EXISTS LAST_ORDER( id INTEGER PRIMARY KEY AUTOINCREMENT, category INTEGER NOT NULL, _order TEXT NOT NULL, FOREIGN KEY(category) REFERENCES CATEGORY(id) ON UPDATE CASCADE ON DELETE CASCADE )",function(err) {});
        db.run("CREATE TABLE IF NOT EXISTS NOTE( id INTEGER PRIMARY KEY AUTOINCREMENT, note TEXT NOT NULL, category INTEGER, FOREIGN KEY(category) REFERENCES CATEGORY(id) ON UPDATE CASCADE ON DELETE CASCADE )",function(err) {});
        db.run("CREATE TABLE IF NOT EXISTS LAST_STATE( id INTEGER PRIMARY KEY AUTOINCREMENT, x INTEGER NOT NULL, y INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, ui TEXT, type TEXT, note INTEGER NOT NULL)",function(err) {
          if(err == null)
            stateTableCreated = true;
        });
        var count = 0;
        db.get("SELECT COUNT(*) AS count FROM LAST_SELECTED_CATEGORY", function(err, row){
          count = row.count;
          if(count == 0) {
            db.run("INSERT INTO LAST_SELECTED_CATEGORY(category, type) VALUES(?, ?)", 0, 'TASK', function(error){});
            db.run("INSERT INTO LAST_SELECTED_CATEGORY(category, type) VALUES(?, ?)", 0, 'NOTE', function(error){
              if(error == null)
                global.proceed = true;
            });
          }else{
            global.proceed = true;
          }
        });
      });
    }
  });

  //Print Note as PDF : CALLED FROM RENDERER WHEN CTRL+SHIFT+E IS PRESSED
  var dimensions = {height:50000000000, width: 100000000000};
  ipc.on('print-as-pdf', function (event, name) {
    const pdfPath = app.getPath('home') +'/'+name+'.pdf';
    const win = BrowserWindow.fromWebContents(event.sender);
    win.webContents.printToPDF( {
      pageSize: dimensions,
      marginsType: 2,
      printBackground: true
    }, function (error, data) {
      if (error) throw error;
      fs.writeFile(pdfPath, data, function (error) {
        shell.openItem(pdfPath);
      })
    })
  });

  // Initializing the App
  app.on('ready', function() {

    protocol.unregisterProtocol('', () => {

      // Initialize The Window
      mainWindow = new BrowserWindow({
        frame:false,
        width: 350,
        height: 450,
        minHeight: 450,
        minWidth: 350,
        icon: __dirname + '/Vectors/Icon/256x256.png',
        transparent: true,
        show: false
      });

      mainWindow.on('ready-to-show', function() {
        mainWindow.show();
        mainWindow.focus(); 
      });

      // Load The Index Page
      mainWindow.loadURL(url.format({
        pathname: path.join(__dirname,'index.html'),
        protocol: 'file:',
        slashes: true
      }));

      // mainWindow.openDevTools();
      Menu.setApplicationMenu(null);


      //RESTORE WINDOW STATE OR INITIALIZE THE STATE TABLE
      db.get("SELECT x, y, width, height, type FROM LAST_STATE", function(err, row) {
        if(row){
          mainWindow.setPosition(row.x, row.y);
          mainWindow.setSize(row.width, row.height);
        } else {
          initState();
        }
      });

      //Wait for the state table to be created and initialize it
      function initState() {
        var tHandle = setInterval(function() {
          if(stateTableCreated){
            db.run("INSERT INTO LAST_STATE(x, y, width, height, ui, type, note) VALUES(250, 200, 350, 450, \"DARK\", \"TASK\", 0)", function(error){
              if(error)
                console.log(error);
            });
            clearInterval(tHandle);
          }
        },10);
      }

      // Save The State on Exit
      var x, y, width, height;
      mainWindow.on('close', function(event) {
        var pos = 
        x = mainWindow.getPosition()[0];
        y = mainWindow.getPosition()[1];
        width = mainWindow.getSize()[0];;
        height = mainWindow.getSize()[1];
        saveState();
      });

      function saveState() {
        db.run("UPDATE LAST_STATE SET x=?, y=?, width=?, height=? WHERE id=?", x, y, width, height, 1, function(error){
          if(error == null)
            app.quit();
        });
      }

    });

  });

});

