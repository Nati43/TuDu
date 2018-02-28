const electron = require('electron');
var fs = require('fs');
const url = require('url');
const path = require('path');
const sqlite = require('sqlite3').verbose();

const {app, BrowserWindow, Menu, protocol} = electron;

app.disableHardwareAcceleration();

var dbFlag = false;
var stateTableCreated = false;
var mainWindow;

fs.mkdir(app.getPath('home') + '/\.TuDu',function(){

   var dbPath = app.getPath('home') + '/\.TuDu/Data.db';

   global.db = new sqlite.Database(dbPath, function(err) {
      if(err == null){

         db.serialize(function() {
            db.run("CREATE TABLE IF NOT EXISTS CATEGORY ( id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, type TEXT NOT NULL )",function(err) {
               if(err)
                  console.log(err);
               // else
               //    console.log("CATEGORY TABLE CREATED");
            });
            db.run("CREATE TABLE IF NOT EXISTS TASK ( id INTEGER PRIMARY KEY AUTOINCREMENT, task TEXT NOT NULL, state INTEGER NOT NULL, category INTEGER, FOREIGN KEY(category) REFERENCES CATEGORY(id) ON UPDATE CASCADE ON DELETE CASCADE )",function(err) {
               if(err)
                  console.log(err);
               // else
               //    console.log("TASK TABLE CREATED");
            });
            // db.run("CREATE TABLE IF NOT EXISTS LAST_SELECTED_CATEGORY( id INTEGER PRIMARY KEY AUTOINCREMENT, category INTEGER NOT NULL, FOREIGN KEY(category) REFERENCES CATEGORY(id) ON UPDATE CASCADE ON DELETE CASCADE )",function(err) {
            db.run("CREATE TABLE IF NOT EXISTS LAST_SELECTED_CATEGORY( id INTEGER PRIMARY KEY AUTOINCREMENT, category INTEGER NOT NULL, type TEXT NOT NULL, FOREIGN KEY(category) REFERENCES CATEGORY(id) ON UPDATE CASCADE ON DELETE CASCADE )",function(err) {
               if(err)
                  console.log(err);
               // else
               //    console.log("LAST_SELECTED_CATEGORY TABEL CREATED");
            });
            db.run("CREATE TABLE IF NOT EXISTS LAST_ORDER( id INTEGER PRIMARY KEY AUTOINCREMENT, category INTEGER NOT NULL, _order TEXT NOT NULL, FOREIGN KEY(category) REFERENCES CATEGORY(id) ON UPDATE CASCADE ON DELETE CASCADE )",function(err) {
               if(err)
                  console.log(err);
               // else
               //    console.log("LAST_ORDER TABEL CREATED");
            });
            db.run("CREATE TABLE IF NOT EXISTS NOTE( id INTEGER PRIMARY KEY AUTOINCREMENT, note TEXT NOT NULL, category INTEGER, FOREIGN KEY(category) REFERENCES CATEGORY(id) ON UPDATE CASCADE ON DELETE CASCADE )",function(err) {
               if(err)
                  console.log(err);
               // else
               //    console.log("LAST_ORDER TABEL CREATED");
            });
            db.run("CREATE TABLE IF NOT EXISTS LAST_STATE( id INTEGER PRIMARY KEY AUTOINCREMENT, x INTEGER NOT NULL, y INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, ui TEXT, type TEXT, note INTEGER NOT NULL)",function(err) {
               if(err)
                  console.log(err);
               else
                  stateTableCreated = true;
            });
            var count = 0;
            db.get("SELECT COUNT(*) AS count FROM LAST_SELECTED_CATEGORY", function(err, row){
               count = row.count;
               if(count == 0) {
                  db.run("INSERT INTO LAST_SELECTED_CATEGORY(category, type) VALUES(?, ?)", 0, 'TASK', function(error){});
                  db.run("INSERT INTO LAST_SELECTED_CATEGORY(category, type) VALUES(?, ?)", 0, 'NOTE', function(error){});
               }
            });
         });
      }
   });

   app.on('ready', function() {

      protocol.unregisterProtocol('', () => {
         
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

         mainWindow.loadURL(url.format({
            pathname: path.join(__dirname,'index.html'),
            protocol: 'file:',
            slashes: true
         }));

         mainWindow.openDevTools();
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

         var x, y, width, height;
         mainWindow.on('close', function(event) {
            var pos = 
            x = mainWindow.getPosition()[0];
            y = mainWindow.getPosition()[1];
            width = mainWindow.getSize()[0];;
            height = mainWindow.getSize()[1];
            saveState();
         });

         function initState() {
            //Wait for the state table to be created and initialize it
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

         function saveState() {
            db.run("UPDATE LAST_STATE SET x=?, y=?, width=?, height=? WHERE id=?", x, y, width, height, 1, function(error){
               if(error == null)
                  app.quit();
            });
         }

      });

   });

});
