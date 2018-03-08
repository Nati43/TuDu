var {remote} = require('electron');  
const sqlite = require('sqlite3').verbose();
const Sortable = require('sortablejs');
var dbFlag = false;

var db = null;
if(db = remote.getGlobal('db')){
   dbFlag = true;
}

//Fix for the drop files bug
window.addEventListener("dragover",function(e){
  e = e || event;
  e.preventDefault();
},false);
window.addEventListener("drop",function(e){
  e = e || event;
  e.preventDefault();
},false);

var lastCategoryType = 'TASK';

//GLOBAL FLAGS
var selectedCategory = 0;
var scrollFlag = false;
var successFlag = false;
var addedOnEmpty = false;
var uiState = "DARK";
//For Notes
var openNote = 0;
var openNoteFlag = false;

//Loads all the categories at startup
function loader(){
   selectedCategory = 0;
   var tHandle = setInterval(function(){

      if(dbFlag && remote.getGlobal('proceed')) {
         clearInterval(tHandle);

         console.log("Connected to DB!");

         db.get('SELECT type, note FROM LAST_STATE WHERE id=1', function(err, row) {
            if(row) {
               lastCategoryType = row.type;
               if(lastCategoryType == 'NOTE' && row.note != 0) {
                  openNoteFlag = true;
                  openNote = row.note;
               }
               proceed();
            }
         });

         function proceed(){
            // db.get("SELECT c.id AS id, c.type AS type FROM CATEGORY AS c, LAST_SELECTED_CATEGORY AS ls WHERE c.id=ls. AND c.type=? category ORDER BY id DESC LIMIT 1", lastCategoryType, function(err, row) {
            // db.get("SELECT id FROM CATEGORY WHERE id IN (SELECT category FROM LAST_SELECTED_CATEGORY ORDER BY id DESC LIMIT 1)", function(err, row) {
            db.get("SELECT category, type FROM LAST_SELECTED_CATEGORY WHERE type=?", lastCategoryType, function(err, row) {
               if(row) {
                  selectedCategory = row.category;
               }
               uiLoader();
               if(lastCategoryType == 'TASK'){
                  document.querySelector('.tasks-tab').classList.add('activeTransparent');
               }else if (lastCategoryType == 'NOTE') {
                  document.querySelector('.notes-tab').classList.add('activeTransparent');
               }
               if(selectedCategory == 0) {
                  popup();
                  document.getElementById('closePopupBtn').style.pointerEvents = 'none';
                  document.getElementById('closePopupBtn').style.textDecoration = 'line-through';
               } else {
                  loadCategories();
                  if(lastCategoryType == 'TASK'){
                     loadTasksToCategory();
                  }else if (lastCategoryType == 'NOTE') {
                     loadNotesToCategory();
                  }
               }

            });               
         }     

      }else {
         // console.log("Sorry! No db Found!");
      }
   }, 10);
}

///#######################///
/// CATEGORY MANIPULATION ///
///#######################///

//To load all the categories in the Database
function loadCategories(){

   if(document.getElementById('closePopupBtn').style.pointerEvents == 'none' && document.getElementById('closePopupBtn').style.textDecorationLine == 'line-through') {
      document.getElementById('closePopupBtn').style.pointerEvents = 'initial';
      document.getElementById('closePopupBtn').style.textDecoration = 'initial';
   }

   var categoryList = document.querySelector('.categoryList');
   db.each("SELECT id, category FROM CATEGORY WHERE type=?", lastCategoryType, function(err, row) {
      var category = document.createElement('LI');
      category.setAttribute('class','category');
      category.setAttribute('categoryId',row.id);
      category.style.position = 'relative';

      if(selectedCategory == row.id){
         category.classList.add('activeTransparent');
         // if(uiState == "TRANSPARENT")
         //    category.classList.add('activeTransparent');
         // else
         //    category.classList.add('active');
      }

      var span = document.createElement('SPAN');
      span.setAttribute('class','categoryContent');
      span.innerHTML = row.category;
      span.style.pointerEvents = 'none';

      var editC = document.createElement('DIV');
      editC.setAttribute('class','edit_icon');
      editC.setAttribute('onclick','categoryEditor(event, this);');

      var deleteC = document.createElement('DIV');
      deleteC.setAttribute('class','delete_icon');
      deleteC.setAttribute('onclick','categoryDeleter(event, this);');

      category.appendChild(span);
      category.appendChild(editC);
      category.appendChild(deleteC);


      category.style.left = '-120vw';


      category.onclick = function(event){categorySelector(event);};
      categoryList.appendChild(category);

      category.style.transform = "translateX(120vw)";

   });
}

//Fired when a category is selected
function categorySelector(event) {

   if(event.srcElement.getAttribute('categoryId') != selectedCategory){
      
      // var cls = 'active';
      // if(uiState == 'TRANSPARENT')
      var cls = 'activeTransparent';

      var categories =  document.querySelectorAll('.category');
      for(var i=0; i<categories.length; i++){
         categories[i].classList.remove(cls);
      }

      event.srcElement.classList.add(cls);
      selectedCategory = event.srcElement.getAttribute('categoryId');
      // db.run("INSERT INTO LAST_SELECTED_CATEGORY(category) VALUES(?)", selectedCategory, function(error){
      //    if(error == null){
      //       console.log('LAST_SELECTED_CATEGORY ALTERED');
      //    }
      // });
      db.run("UPDATE LAST_SELECTED_CATEGORY SET category=? WHERE type=?", selectedCategory, lastCategoryType, function(error){
         if(error == null) {
            console.log('LAST_SELECTED_CATEGORY ALTERED');
         }
      });

      if(lastCategoryType == 'TASK')
         loadTasksToCategory();
      else if (lastCategoryType == 'NOTE') {
         loadNotesToCategory();
      }

   }
   document.querySelector('.menuTogglerNav').click();
}

//Fired when the delete category icon is clicked
function categoryDeleter(event, obj) {
   event.stopPropagation();
   var category = obj.parentElement;
   var categoryId = category.getAttribute('categoryId');

   db.serialize(function(){

      // db.run("DELETE FROM LAST_SELECTED_CATEGORY WHERE category="+categoryId, function(err){});      
      db.run("UPDATE LAST_SELECTED_CATEGORY  SET category=? WHERE category=?", 0, categoryId, function(err){});

      db.run("DELETE FROM CATEGORY WHERE id=?",categoryId, function(err){
         if(err){
            console.log(err);
         }else{
            category.style.transform = "translateX(-200vw)";
            setTimeout(function(){
               category.parentElement.removeChild(category);
            }, 250);
            cleanUp();
         }
      });

      function cleanUp(){
         if(lastCategoryType == 'TASK'){
            db.run("DELETE FROM TASK WHERE category=?",categoryId, function(err){
               if(err){
                  console.log(err);
               }else{
                  step2();
               }
            });
         }else if (lastCategoryType == 'NOTE') {
            db.run("DELETE FROM NOTE WHERE category=?",categoryId, function(err){
               if(err){
                  console.log(err);
               }else{
                  step2();
               }
            });            
         }
         function step2(){
            db.run("DELETE FROM LAST_ORDER WHERE category=? ", categoryId, function(err){
               if(err){
                  console.log(err);
               }else{
                  proceed();
               }
            });
         }

         function proceed(){
            db.get("SELECT COUNT(*) AS num FROM CATEGORY WHERE type=?", lastCategoryType, function(err, row){
               if (err != null) {
                  console.log(err);
               }else if(row.num == 0){
                  var tks = document.querySelectorAll('.task');
                  for(var i=0; i<tks.length; i++){
                     tks[i].parentElement.removeChild(tks[i]);
                  }
                  selectedCategory = 0;
                  popup();
                  document.getElementById('closePopupBtn').style.pointerEvents = 'none';
                  document.getElementById('closePopupBtn').style.textDecorationLine = 'line-through';
               } else {
                  if(selectedCategory == categoryId){                
                     selectOtherCategory();
                  }
               }
            });

            function selectOtherCategory(){
               db.get("SELECT id FROM CATEGORY WHERE type=? ORDER BY id ASC LIMIT 1", lastCategoryType, function(err, row){
                  selectedCategory = row.id;
                  saveNewlySelectedCategory();
               });
            }

            function saveNewlySelectedCategory(){
               // db.run("INSERT INTO LAST_SELECTED_CATEGORY(category) VALUES(?)", selectedCategory, function(error){
               db.run("UPDATE LAST_SELECTED_CATEGORY SET category=? WHERE type=?", selectedCategory, lastCategoryType, function(error){
                  if(error == null) {
                     loadTasksToCategory();
                     if(document.querySelector('.category[categoryId="'+selectedCategory+'"]') && uiState == "TRANSPARENT")
                        document.querySelector('.category[categoryId="'+selectedCategory+'"]').classList.add('activeTransparent');
                     else if(document.querySelector('.category[categoryId="'+selectedCategory+'"]'))
                        // document.querySelector('.category[categoryId="'+selectedCategory+'"]').classList.add('active');
                        document.querySelector('.category[categoryId="'+selectedCategory+'"]').classList.add('activeTransparent');
                  }
               });
            }

         }


      };

   });

}

//Fired when the edit category icon is clicked
function categoryEditor(event, obj) {
   event.stopPropagation();
   var category = obj.parentElement;
   var categoryId = category.getAttribute('categoryId');
   var categoryContent = obj.previousSibling;
   categoryContent.style.opacity = '0';

   var input = document.createElement('INPUT');
   input.setAttribute('class','txtBox');
   input.classList.add('editTxtBox');
   input.value = categoryContent.textContent;
   category.appendChild(input);

   input.onclick = function(event){
      event.stopPropagation();
   };

   input.focus();

   input.onblur = function() {
      if(input.value == categoryContent.textContent){
         category.removeChild(input);
         categoryContent.style.opacity = '1';
      }else{
         // console.log("NOT THE SAME");

         db.run("UPDATE CATEGORY SET category=? WHERE id=?",input.value, categoryId, function(err){
            if(err){
               // console.log(err);
            }else{
               // console.log("Category Saved TO DATABASE");
            }
         });
         categoryContent.textContent = input.value;
         category.removeChild(input);
         categoryContent.style.opacity = '1';
      }
   };

   input.onkeypress = function(event){
      if(event.key == "Enter"){
         input.blur();
      }
   };
}

//Fired when the add new category icon is clocked
function addCategory(event){
   if(event.type == 'click' || (event.type == "keypress" && event.key == "Enter")){
      var inField = document.getElementById('category_input');
      var category = inField.value;
      if(category != "") {
         var ca = document.querySelectorAll('.category');
         for(var i=0; i<ca.length; i++) {
            ca[i].parentElement.removeChild(ca[i]);
         }
         var newID = 0;

         db.get("SELECT COUNT(*) AS num FROM CATEGORY WHERE type=?", lastCategoryType, function(err, row){
            if(err == null){
               if(row && row.num == 0)
                  addedOnEmpty = true;
               proceed();
            }
         });

         function proceed(){
            db.serialize(function() {
               db.run("INSERT INTO CATEGORY(type, category) VALUES (?,?)", lastCategoryType, category,function(err){
                  if (err) {
                     // return console.log(err.message);
                  }
               });

               db.get("SELECT * FROM CATEGORY ORDER BY id DESC LIMIT 1", function(err, row){
                  // console.log("ERROR : "+err);
                  // console.log("LAST ID : "+row.id);
                  if(row)
                     newID = row.id;
                  // else
                  //    console.log("NO CATEGORY YET");
                  // console.log("newID : "+newID);
                  inField.value = "";
                  addToOrderList(newID);
               });
            });
         }

      }
   }
}

//Adds the new Category to the Order List with order []
function addToOrderList(newID) {
   db.serialize(function(){

      if(addedOnEmpty) {
         // db.run("INSERT INTO LAST_SELECTED_CATEGORY(type, category) VALUES(?, ?)", lastCategoryType, newID, function(error){
         db.run("UPDATE LAST_SELECTED_CATEGORY SET category=? WHERE type=?", newID, lastCategoryType, function(error){
            if(error == null){
               // console.log('LAST_SELECTED_CATEGORY ALTERED');
            }
         });
      }
      db.run("INSERT INTO LAST_ORDER(category, _order) VALUES(?, ?)", newID, "[]", function(err){
         // console.log("CATEGORY ADDED TO ORDER LIST");
         if(selectedCategory == 0) {
            // console.log("ADDED ON EMPTY");
            // console.log("SELECTED CATEGORY :"+newID);
            selectedCategory = newID;
         }
         closePopup();
         loadCategories();
      });

   });
}


//####################//
///TASK MANIPULATION ///
//####################//

var moved = false;
//Responsible for restructuring the addField when its
//overflow changes due to posting deleteing or cutting its content
function addFieldController(event, addField) {
   if(event.code == "Delete" || event.code == "Backspace" || event.code == "KeyV" && event.ctrlKey == true || event.code == "KeyX" && event.ctrlKey == true || event.code == "KeyZ" && event.ctrlKey == true){
      if(!moved && addField.scrollHeight > 35) {
         addField.style.top = '-10px';
         moved = true;
      } else if(moved && addField.scrollHeight <= 35) {
         addField.style.top = '0px';
         moved = false;
      }
   }
}

//Fired when a new task is added to a category
function addHandler(event, addField){

   if(!moved && addField.scrollHeight > 35) {
      addField.style.top = '-10px';
      moved = true;
   } else if(moved && addField.scrollHeight <= 35) {
      addField.style.top = '0px';
      moved = false;
   }

   // if(event.key == "Enter" && addField.value != "") {
   if(event.key == "Enter") {
      event.preventDefault();

      if(addField.innerHTML != "" && addField.innerHTML != "Add Task") {

         console.log("Trying to add to category "+selectedCategory+" task "+addField.value+" ?");

         successFlag = false;

         // var task = addField.value;
         var task = addField.innerHTML;
         // addField.value = "";
         addField.innerHTML = "";
         document.querySelector('.entryContainer .add_icon').style.opacity = '1';
         var state = 0;
         var category = selectedCategory;
         db.serialize(function(){

            db.run("INSERT INTO TASK(task, state, category) VALUES (?,?,?)",task, state, category,function(err){
               if (err) {
                  // return console.log(err.message);
               }
               // console.log("INSERTED TASK "+task+" INTO CATEGORY "+category);
               getTaskId();
            });

            function getTaskId(){
               var newID;
               db.get("SELECT * FROM TASK ORDER BY id DESC LIMIT 1", function(err, row){
                  if(row)
                     newID = row.id;
                  alterOrderList(newID);
               });
            }

            function alterOrderList(newID){
               var list = document.getElementById('tasks');
               var order = [];
               [].forEach.call(list.children, function(element) {
                  var taskID = element.getAttribute('value');
                  if(order.indexOf(taskID) == -1)
                     order.push(taskID);
               });
               order.push(newID);
               var str = JSON.stringify(order);
               // console.log("ORDER AFTER ADDING"+str);
               // console.log(selectedCategory);
               db.run(" UPDATE LAST_ORDER SET _order=? WHERE category=? ",str, selectedCategory, function randomName(err){
                  // console.log("ORDER LIST UPDATED");
                  successFlag = true;
                  if(moved){
                     addField.style.top = '0px';
                     moved = false;
                  }
                  loadTasksToCategory();
                  scrollToBottom();
               });
               
            }

         });
      }
      
   }else if(event.ctrlKey == true && event.code == 'Period') {
      var fontSize = document.queryCommandValue("FontSize");
      fontSize++;
      document.execCommand("fontSize", false, fontSize);
   }else if(event.ctrlKey == true && event.code == "Comma"){
      var fontSize = document.queryCommandValue("FontSize");
      fontSize--;
      document.execCommand("fontSize", false, fontSize);
   }
}

//Scroll to bottom when new task is added
function scrollToBottom(){

   var tHandle = setInterval(function(){
      if(successFlag && scrollFlag){
         clearInterval(tHandle);
         var tasks = document.getElementById("tasks");
         tasks.scrollTop = tasks.scrollHeight;
         successFlag = false;
         scrollFlag = false;
         // console.log('RESET EVERYTHING');
      }
   },10);
}

//To load all the tasks in a category
function loadTasksToCategory() {

   scrollFlag = false;

   var tks = document.querySelectorAll('.task');
   for(var i=0; i<tks.length; i++){
      tks[i].parentElement.removeChild(tks[i]);
   }

   var tasks = document.querySelector('.tasks');

   if(tasks.querySelector('.Indicator')){
      tasks.removeChild(document.querySelector('.Indicator'));
   }

   var taskList = [];

   db.serialize(function(){

      db.all("SELECT id, task, state, category FROM TASK WHERE category="+selectedCategory, function(err, rows) {
         if(rows)
            loadResultset(rows);
      });

      function loadResultset(rows){

         rows.forEach(function(row) {
            var task = document.createElement('DIV');
            task.setAttribute('class','task');
            task.setAttribute('value',row.id);

            var label = document.createElement('LABEL');
            label.setAttribute('class','checkbox-container');

            var span = document.createElement('SPAN');
            span.setAttribute('class','taskContent');
            span.innerHTML = row.task;
            label.appendChild(span);
            var checkbox = document.createElement('INPUT');
            checkbox.setAttribute('type','checkbox');
            checkbox.setAttribute('onchange','checkHandler(this)');
            if(row.state == 1){
               checkbox.checked = true;
               task.style.opacity = 0.5;
               span.style.textDecoration = 'line-through';
            }else{
               checkbox.checked = false;
               task.style.opacity = 1;
               span.style.textDecoration = 'unset';
            }
            var checkmark = document.createElement('SPAN');
            checkmark.setAttribute('class','checkmark');
            label.appendChild(checkbox);
            label.appendChild(checkmark);
            var editIcon = document.createElement('DIV');
            editIcon.setAttribute('class','edit_icon');
            editIcon.setAttribute('onclick','editHandler(this)');
            var deleteIcon = document.createElement('DIV');
            deleteIcon.setAttribute('class','delete_icon');
            deleteIcon.setAttribute('onclick','deleteHandler(this)');

            task.appendChild(label);
            task.appendChild(editIcon);
            task.appendChild(deleteIcon);


            // tasks.appendChild(task);
            taskList.push(task);
         });



         if(taskList.length == 0) {
            var p = document.createElement('P');
            p.innerHTML = "<span>🤔</span><br>No Tasks Yet";
            p.setAttribute('class', 'Indicator');
            tasks.appendChild(p);
         }


         var lastOrder = "";
         db.get("SELECT _order FROM LAST_ORDER WHERE category=?", selectedCategory, function(err, row){
            if(row){
               lastOrder = row._order;

               var allDone = true;
               
               if(lastOrder && lastOrder != "[]") {
                  var orderList = JSON.parse(lastOrder);
                  orderList.forEach(function(t){
                     [].forEach.call(taskList, function(tsk) {
                        if(t == tsk.getAttribute('value')) {
                           tasks.appendChild(tsk);
                           if(tsk.querySelector('input').checked == false)
                              allDone = false;
                        }
                     });
                  });
                  scrollFlag = true;

                  if(allDone && taskList.length != 0) {
                     var p = document.createElement('P');
                     p.innerHTML = "<span>☺️</span>All Done !";
                     p.setAttribute('class', 'Indicator IndicatorDone');
                     tasks.insertBefore(p, tasks.children[0]);
                  }

               }else{
                  allDone = false;
               }

            }
         });


         var list = document.getElementById('tasks');
         var sortable = Sortable.create(list,{
            onStart: function(evt) {
               [].forEach.call(tasks.children, function(element) {
                  if(element.classList.contains('task'))
                     element.querySelector('input[type=checkbox]').setAttribute('disabled','true');
               });
            },
            onEnd: function (evt) {
               //ALTERING LAST ORDER WHEN REORDERING TASKS
               var order = [];
               [].forEach.call(tasks.children, function(element) {
                  if(element.classList.contains('task')) {
                     element.querySelector('input[type=checkbox]').removeAttribute('disabled');
                     var taskID = element.getAttribute('value');
                     if(order.indexOf(taskID) == -1)
                     order.push(taskID);
                  }
               });
               var str = JSON.stringify(order);
               // console.log(str);
               // console.log(selectedCategory);
               db.run(" UPDATE LAST_ORDER SET _order=? WHERE category=? ",str, selectedCategory, function(err){
                  // console.log("ORDER LIST UPDATED");
               });
            }
         });

      }

   });
}

//Fired when a task is checked or unchecked
function checkHandler(checkbox){

   var taskID = checkbox.parentElement.parentElement.getAttribute('value');
   var task = checkbox.parentElement.parentElement;
   var tasks = task.parentElement;
   // console.log("TASK ID = "+taskID);
   if(checkbox.checked){

      // console.log("CHECKED");
      db.run("UPDATE TASK SET state=? WHERE id=?",1,taskID, function(err){
         if(err){
            // console.log(err);
         }else{
            // console.log("STATE SAVED TO DATABASE");
            task.style.opacity = 0.5;
            task.querySelector('.taskContent').style.textDecoration = 'line-through';
         }
      });

   }else{
      // console.log("UNCHECKED");
      db.run("UPDATE TASK SET state=? WHERE id=?",0,taskID, function(err){
         if(err){
            // console.log(err);
         }else{
            // console.log("STATE SAVED TO DATABASE");
            task.style.opacity = 1;
            task.querySelector('.taskContent').style.textDecoration = 'unset';
         }
      });
   }

   var allDone = true;
   
   for (var i=0; i<tasks.children.length; i++) {
      var element = tasks.children[i];
      if(element.querySelector('input') && element.querySelector('input').checked == false)
         allDone = false;
   }

   if(allDone) {
      var p = document.createElement('P');
      p.innerHTML = "<span>☺️</span>All Done !";
      p.setAttribute('class', 'Indicator IndicatorDone');
      tasks.insertBefore(p, tasks.children[0]);
   } else {
      if(tasks.querySelector('.Indicator'))
         tasks.querySelector('.Indicator').parentElement.removeChild(tasks.querySelector('.Indicator'));
   }
}

//Fired whent the edit task icon is clicked
function editHandler(obj){

   var task = obj.parentElement;
   var taskID = task.getAttribute('value');
   var label = obj.previousSibling;
   var taskContent = label.querySelector('.taskContent');

   var initialValue = taskContent.innerHTML;

   taskContent.parentElement.nextSibling.style.display = 'none';
   taskContent.parentElement.nextSibling.nextSibling.style.display = 'none';
   taskContent.nextSibling.style.display = 'none';
   taskContent.nextSibling.nextSibling.style.display = 'none';
   taskContent.onclick = function(e){
      e.preventDefault();
      e.stopPropagation();
   }

   //Making it contentEditable enables awesome features
   taskContent.contentEditable = true;
   taskContent.classList.add('editable');
   taskContent.focus();

   //Save Changes on blur
   taskContent.onblur = function() {
      if(taskContent.innerHTML == initialValue){
         restore();
      }else{
         db.run("UPDATE TASK SET task=? WHERE id=?",taskContent.innerHTML, taskID, function(err){
            if(err){
               // console.log(err);
            }else{
               // console.log("Task Saved TO DATABASE");
            }
         });
         restore();
      }
   };

   //Save changes when 'Enter' pressed
   //Increase and Decrease font size when 'ctrl+./,' keys pressed
   taskContent.onkeypress = function(event) {
      if(event.key == "Enter"){
         taskContent.blur();
      }else if(event.ctrlKey == true && event.code == 'Period') {
         var fontSize = document.queryCommandValue("FontSize");
         fontSize++;
         document.execCommand("fontSize", false, fontSize);
      }else if(event.ctrlKey == true && event.code == "Comma"){
         var fontSize = document.queryCommandValue("FontSize");
         fontSize--;
         document.execCommand("fontSize", false, fontSize);
      }
   };

   //Restore task to its initial state after changes are saved
   function restore() {
      taskContent.parentElement.nextSibling.style.display = 'block';
      taskContent.parentElement.nextSibling.nextSibling.style.display = 'block';
      taskContent.nextSibling.style.display = 'block';
      taskContent.nextSibling.nextSibling.style.display = 'block';
      taskContent.onclick = null;
      taskContent.contentEditable = false;
      taskContent.classList.remove('editable');
   }
}

//Fired when the delete task icon is clicked
function deleteHandler(obj){

   var taskID = obj.parentElement.getAttribute('value');
   var task = obj.parentElement;
   var tasks = task.parentElement;
   // console.log("Trying to Delete Task "+taskID);

   db.run("DELETE FROM TASK WHERE id=?",taskID, function(err){
      if(err){
         // console.log(err);
      }else{
         task.style.transform = "translateX(-200vw)";
         setTimeout(function(){
            task.parentElement.removeChild(task);
            var order = [];
            [].forEach.call(tasks.children, function(element){
               var taskID = element.getAttribute('value');
               if(order.indexOf(taskID) == -1)
                  order.push(taskID);
            });
            var str = JSON.stringify(order);
            db.run("UPDATE LAST_ORDER SET _order=? WHERE category=? ",str, selectedCategory, function(err){
               // console.log("ORDER LIST UPDATED");
            });

            if(tasks.querySelector('.Indicator') && tasks.children.length == 1) {
               tasks.removeChild(tasks.querySelector('.Indicator'));
               var p = document.createElement('P');
               p.innerHTML = "<span>🤔</span><br>No Tasks Yet !";
               p.setAttribute('class', 'Indicator');
               // document.querySelector('.body').insertBefore(p, tasks);
               tasks.insertBefore(p, tasks.children[0]);
            }else if(tasks.children.length == 0) {
               var p = document.createElement('P');
               p.innerHTML = "<span>🤔</span><br>No Tasks Yet !";
               p.setAttribute('class', 'Indicator');
               // document.querySelector('.body').insertBefore(p, tasks);
               tasks.insertBefore(p, tasks.children[0]);
            } else {
               var allDone = true;
               for (var i=0; i<tasks.children.length; i++) {
                  var element = tasks.children[i];
                  if(element.querySelector('input') && element.querySelector('input').checked == false)
                     allDone = false;
               }
               if(allDone && tasks.children[0].nodeName != 'P') {
                  var p = document.createElement('P');
                  p.innerHTML = "<span>☺️</span>All Done !";
                  p.setAttribute('class', 'Indicator IndicatorDone');
                  tasks.insertBefore(p, tasks.children[0]);
               }
            }

         }, 250);
      }
   });
}

//Fix for Add Icon overlap
document.getElementById('addField').oninput = function(){

   if(this.textContent.length > 0)
      document.querySelector('.entryContainer .add_icon').style.opacity = '0';
   else
      document.querySelector('.entryContainer .add_icon').style.opacity = '1';
}

//UI Changer
function themeChanger(obj) {
   document.querySelector('.nav').classList.toggle('navTransparent');
   document.querySelector('.body').classList.toggle('bodyTransparent');
   document.querySelector('.popup').classList.toggle('popupTransparent');
   document.querySelector('.popupBtn').classList.toggle('popupBtnTransparent');
   document.getElementById('closePopupBtn').classList.toggle('popupBtnTransparent');

   // if(document.querySelector('.activeTransparent') && uiState == 'TRANSPARENT'){
   //    document.querySelector('.activeTransparent').classList.add('active');
   //    document.querySelector('.activeTransparent').classList.remove('activeTransparent');
   // }else if(document.querySelector('.active')) {
   //    document.querySelector('.active').classList.add('activeTransparent');
   //    document.querySelector('.active').classList.remove('active');      
   // }

   var ui = "DARK";
   if(obj.checked == true) {
      ui = "TRANSPARENT";
   }

   uiState = ui;

   db.run("UPDATE LAST_STATE SET ui=? WHERE id=?", ui, 1, function(error){});
}

//RESTORE WINDOW UI STATE
function uiLoader() {
   db.get("SELECT ui FROM LAST_STATE", function(err, row){
      if(row){
         if(row.ui == "TRANSPARENT"){
            uiState = "TRANSPARENT";
            document.querySelector('.nav').classList.add('navTransparent');
            document.querySelector('.body').classList.add('bodyTransparent');
            // if(document.querySelector('.active')){
            //    document.querySelector('.active').classList.add('activeTransparent');
            //    document.querySelector('.active').classList.remove('active');
            // }
            document.querySelector('.popup').classList.add('popupTransparent');
            document.querySelector('.popupBtn').classList.add('popupBtnTransparent');
            document.getElementById('closePopupBtn').classList.toggle('popupBtnTransparent');
            document.getElementById('themeCheckbox').checked  = true;
         }
      }
   });

   if(lastCategoryType == 'NOTE') {
      document.querySelector('.tasksBody').style.display = "none";
      document.querySelector('.notesBody').style.display = 'unset';
   } else {
      document.querySelector('.notesBody').style.display  = "none";
      document.querySelector('.tasksBody').style.display = 'unset';
   }
}


//####################//
///NOTE MANIPULATION ///
//####################//

//Resets the categoryList on tab change
function resetCategoryList() {
   var categories = document.querySelectorAll('.category');
   categories.forEach( function(category, index) {
      category.style.transform = "translateX(-200vw)";
      setTimeout(function(){
         category.parentElement.removeChild(category);
      }, 250);
      // category.parentElement.removeChild(category);
   });
}

//Changes between Tasks and Notes
function tabChanger(obj) {
   if(obj.classList.contains('tasks-tab')) {
      if(lastCategoryType == 'TASK'){
         return false;
      } else {
         if(document.querySelector('.popup').classList.contains('popupOpen'))
            closePopup();
         obj.classList.add('activeTransparent');
         document.querySelector('.notes-tab').classList.remove('activeTransparent');
         resetCategoryList();
         document.querySelector('.notesBody').style.display  = "none";
         document.querySelector('.noteViewer').style.display = 'none';
         document.querySelector('.tasksBody').style.display = 'unset';
         lastCategoryType = 'TASK';
         db.run("UPDATE LAST_STATE SET type=? WHERE id=?", lastCategoryType, 1, function(error){
            if(error)
               console.log(error);
         });
         setTimeout(function(){
            loader();
         }, 250);
      }

   } else if(obj.classList.contains('notes-tab')) {

      if(lastCategoryType == 'NOTE'){
         return false;
      } else {
         if(document.querySelector('.popup').classList.contains('popupOpen'))
            closePopup();
         obj.classList.add('activeTransparent');
         document.querySelector('.tasks-tab').classList.remove('activeTransparent');
         resetCategoryList();
         document.querySelector('.tasksBody').style.display = "none";
         document.querySelector('.notesBody').style.display = 'unset';
         lastCategoryType = 'NOTE';
         db.run("UPDATE LAST_STATE SET type=? WHERE id=?", lastCategoryType, 1, function(error){
            if(error)
               console.log(error);
         });
         setTimeout(function(){
            loader();
         }, 250);
      }

   }
}

//Fired when a new note is added to a category
function addNewNote(){
   openNote = 0;
   document.querySelector('.notesBody').style.display = 'none';
   document.querySelector('.noteViewer').style.display = 'block';
}

//Saves note when exiting
function saveNote(){
   var noteContainer = document.querySelector('.noteContent');
   var addRowIcons = noteContainer.querySelectorAll('.addRowIcon');
   var addColIcons = noteContainer.querySelectorAll('.addColIcon');
   var delIcons = noteContainer.querySelectorAll('.delIcon');
   [].forEach.call(addRowIcons, function(icon){
      icon.parentElement.removeChild(icon);
   });
   [].forEach.call(addColIcons, function(icon){
      icon.parentElement.removeChild(icon);
   });
   [].forEach.call(delIcons, function(icon){
      icon.parentElement.removeChild(icon);
   });

   var note = document.querySelector('.noteContent').innerHTML;
   var textContent = document.querySelector('.noteContent').textContent;
   if(textContent != "") {

      if(openNote == 0) {

         db.serialize(function() {
            db.run("UPDATE LAST_STATE SET note=? WHERE id=?", 0, 1, function(error){});
            db.run("INSERT INTO NOTE(note, category) VALUES (?,?)", note, selectedCategory, function(err){
               if (err) {
                  // return console.log(err.message);
               } else {
                  getNoteId();
               }
            });

            function getNoteId(){
               db.get("SELECT * FROM NOTE ORDER BY id DESC LIMIT 1", function(err, row){
                  if(row){
                     openNote = row.id;
                     console.log('NEW NOTE ID : '+openNote);
                     alterOrderList(openNote);
                  }
               });
            }

            function alterOrderList(openNote){
               var list = document.getElementById('notes');
               var order = [];
               [].forEach.call(list.children, function(element) {
                  var noteID = element.getAttribute('value');
                  if(order.indexOf(noteID) == -1)
                     order.push(noteID);
               });
               order.push(openNote);
               var str = JSON.stringify(order);
               db.run(" UPDATE LAST_ORDER SET _order=? WHERE category=? ",str, selectedCategory, function randomName(err){
                  loadNotesToCategory();
                  document.querySelector('.noteContent').innerHTML = "";
               });
            }

         });

      } else {
         db.run("UPDATE LAST_STATE SET note=? WHERE id=?", 0, 1, function(error){});
         db.run("UPDATE NOTE SET note=? WHERE id=?", note, openNote, function(err){
            if (err) {
               // return console.log(err.message);
            } else {
               loadNotesToCategory();
               document.querySelector('.noteContent').innerHTML = "";
            }
         });
      }
   } else {
      document.querySelector('.notesBody').style.display = 'unset';
      document.querySelector('.noteViewer').style.display = 'none';
   }
}

//To load all the notes in a category
function loadNotesToCategory() {

   var notes = document.querySelectorAll('.note');
   for(var i=0; i<notes.length; i++){
      notes[i].parentElement.removeChild(notes[i]);
   }

   var nts = document.querySelector('.notes');
   if(nts.querySelector('.Indicator')) {
      nts.removeChild(nts.querySelector('.Indicator'));
   }

   var noteList = [];

   db.serialize(function(){

      db.all("SELECT id, note, category FROM NOTE WHERE category=?", selectedCategory, function(err, rows) {
         if(rows)
            loadResultset(rows);
      });

      function loadResultset(rows){

         rows.forEach(function(row) {

            var note = document.createElement('DIV');
            note.setAttribute('class','note');
            note.setAttribute('value',row.id);

            var label = document.createElement('LABEL');

            var span = document.createElement('PRE');
            span.setAttribute('class','noteCaption');
            if(row.note.indexOf('<') == -1){
               span.innerHTML = row.note.substring(0, 30);
            }else{
               span.innerHTML = row.note.substring(row.note.indexOf('<b>'), row.note.indexOf('</b>')).slice(0, 30);
               if(span.innerHTML == '') {
                  // span.innerHTML = (row.note.substring(row.note.indexOf('>')+1, row.note.indexOf('</'))).slice(0, 30);
                  span.innerHTML = row.note;
                  span.innerHTML = span.textContent.substring(0, 30);
               }
            }
            label.appendChild(span);

            var deleteIcon = document.createElement('DIV');
            deleteIcon.setAttribute('class','delete_icon');
            deleteIcon.setAttribute('onclick','noteDeleter(this, event)');

            note.appendChild(label);
            note.appendChild(deleteIcon);

            note.onclick = function() {
               noteViewer(row.id);
            }

            noteList.push(note);

         });

         if(noteList.length == 0) {
            var p = document.createElement('P');
            p.innerHTML = "<span>🤔</span><br>No Notes Yet";
            p.setAttribute('class', 'Indicator');
            nts.appendChild(p);
         }

         var lastOrder = "";
         db.get("SELECT _order FROM LAST_ORDER WHERE category=?", selectedCategory, function(err, row){
            if(row) {
               lastOrder = row._order;
               if(lastOrder && lastOrder != "[]") {
                  var orderList = JSON.parse(lastOrder);
                  orderList.forEach(function(n){
                     [].forEach.call(noteList, function(note) {
                        if(n == note.getAttribute('value')) {
                           nts.appendChild(note);
                        }
                     });
                  });
                  document.querySelector('.notesBody').style.display = 'unset';
                  document.querySelector('.noteViewer').style.display = 'none';
                  if(openNoteFlag == true){
                     openNoteFlag = false;
                     noteViewer(openNote);
                  }
               }

            }
         });


         var list = document.getElementById('notes');
         var sortable = Sortable.create(list, {
            onStart: function(evt) {
               // [].forEach.call(nts.children, function(element) {
               //    if(element.classList.contains('note'))
               //       element.querySelector('input[type=checkbox]').setAttribute('disabled','true');
               // });
            },
            onEnd: function (evt) {
               //ALTERING LAST ORDER WHEN REORDERING TASKS
               var order = [];
               [].forEach.call(nts.children, function(element) {
                  if(element.classList.contains('note')) {
                     var noteID = element.getAttribute('value');
                     if(order.indexOf(noteID) == -1)
                        order.push(noteID);
                  }
               });
               var str = JSON.stringify(order);
               db.run(" UPDATE LAST_ORDER SET _order=? WHERE category=? ",str, selectedCategory, function(err){
                  // console.log("ORDER LIST UPDATED");
               });
            }
         });

      }

   });
}

//Fired whent the edit task icon is clicked
function noteViewer(noteID) {
   openNote = noteID;
   db.run("UPDATE LAST_STATE SET note=? WHERE id=?", openNote, 1, function(error){});
   db.get('SELECT note,category FROM NOTE WHERE id=?', noteID, function(err, row) {
      if(row && row.category == selectedCategory) {
         document.querySelector('.noteContent').innerHTML = row.note;
         document.querySelector('.notesBody').style.display = 'none';
         document.querySelector('.noteViewer').style.display = 'block';

         var tbls = document.querySelector('.noteContent').querySelectorAll('table');
         tbls.forEach(function(tbl){      
            tableController(tbl);
         });

      }
   });
}

//Fired when the delete task icon is clicked
function noteDeleter(obj, event){
   event.stopPropagation();

   var noteID = obj.parentElement.getAttribute('value');
   var note = obj.parentElement;
   var notes = note.parentElement;
   // console.log("Trying to Delete Task "+noteID);

   db.run("DELETE FROM NOTE WHERE id=?", noteID, function(err) {
      if(err) {
         // console.log(err);
      } else {
         note.style.transform = "translateX(-200vw)";
         setTimeout(function(){
            note.parentElement.removeChild(note);
            var order = [];
            [].forEach.call(notes.children, function(element){
               var noteID = element.getAttribute('value');
               if(order.indexOf(noteID) == -1)
                  order.push(noteID);
            });
            var str = JSON.stringify(order);
            db.run("UPDATE LAST_ORDER SET _order=? WHERE category=? ",str, selectedCategory, function(err){
               // console.log("ORDER LIST UPDATED");
            });

            if(notes.children.length == 0) {
               var p = document.createElement('P');
               p.innerHTML = "<span>🤔</span><br>No Notes Yet !";
               p.setAttribute('class', 'Indicator');
               notes.insertBefore(p, notes.children[0]);
            }

         }, 250);
      }
   });
}

//The Controller for the note editor
function controller(obj, event) {
   if(event.code == 'Tab') {  //INSERT TAB
      if(event.ctrlKey && event.shiftKey) {
         event.preventDefault();
         document.execCommand("outdent", false);
      }else if(event.ctrlKey){
         event.preventDefault();
         document.execCommand("indent", false);
      }else{
         event.preventDefault();
         var tab = document.createElement('SPAN');
         tab.innerHTML = '&nbsp;&nbsp;&nbsp;&nbsp;';
         var sel = window.getSelection();
         var range = sel.getRangeAt(0);
         range.insertNode(tab);
         range.collapse(false);
      }
   }else if(event.ctrlKey == true && event.code == 'Period') {
      var fontSize = document.queryCommandValue("FontSize");
      fontSize++;
      document.execCommand("fontSize", false, fontSize);
   }else if(event.ctrlKey == true && event.code == "Comma"){
      var fontSize = document.queryCommandValue("FontSize");
      fontSize--;
      document.execCommand("fontSize", false, fontSize);
   }else if(event.ctrlKey && event.code == 'KeyS'){ //INSERT NUMBERINGS
      event.preventDefault();
      saveWhileEditing();
   }else if(event.shiftKey && event.ctrlKey && event.code == 'KeyC') {  //CENTER ALIGN SELECTED SECTION
      event.preventDefault();
      event.stopPropagation();
      document.execCommand("justifyCenter", false);
   }else if(event.shiftKey && event.ctrlKey && event.code == 'KeyL'){ //LEFT ALIGN SELECTED SECTION
      event.preventDefault();
      event.stopPropagation();
      document.execCommand("justifyLeft", false);
   }else if(event.shiftKey && event.ctrlKey && event.code == 'KeyR'){ //RIGHT ALIGN SELECTED SECTION
      event.preventDefault();
      event.stopPropagation();
      document.execCommand("justifyRight", false);   
   }else if(event.shiftKey && event.ctrlKey && event.code == 'KeyB'){ //INSERT BULLETINS
      event.preventDefault();
      document.execCommand("insertUnorderedList", false);
   }else if(event.shiftKey && event.ctrlKey && event.code == 'KeyN'){ //INSERT NUMBERINGS
      event.preventDefault();
      document.execCommand("insertOrderedList", false);
   }else if(event.shiftKey && event.ctrlKey && event.code == 'KeyH'){ //HIGHLIGHTING CONTENT
      event.preventDefault();
      var ht = document.queryCommandValue("backColor");
      if(ht ==  "rgba(50, 130, 80, 0.7)")
         document.execCommand("backColor", false, "unset");
      else
        document.execCommand("backColor", false, "rgba(50, 130, 80, 0.7)");
   }else if(event.shiftKey && event.ctrlKey && event.code == 'KeyT'){ //INSERT TABLE
      event.preventDefault();
      var tbl = document.createElement('TABLE');
      tbl.innerHTML = '<tr><td>&nbsp;</td></tr>';
      var sel = window.getSelection();
      var range = sel.getRangeAt(0);
      var nl = document.createElement('SPAN');
      var nl2 = document.createElement('SPAN');
      nl.innerHTML = '&nbsp;<br>';
      nl2.innerHTML = '<br>&nbsp;';
      range.insertNode(nl2);
      range.insertNode(tbl);
      range.insertNode(nl);
      tableController(tbl);
   }else if(event.shiftKey && event.ctrlKey && event.code == 'BracketLeft'){ //INSERT CODE BLOCK
      event.preventDefault();
      var blc = document.createElement('PRE');
      blc.setAttribute('class', 'codeBlock');
      blc.setAttribute('contenteditable', 'true');
      blc.innerHTML = '<pre> </pre>';
      var sel = window.getSelection();
      var range = sel.getRangeAt(0);
      var nl = document.createElement('SPAN');
      var nl2 = document.createElement('SPAN');
      nl.innerHTML = '&nbsp;<br>';
      nl2.innerHTML = '<br>&nbsp;';
      range.insertNode(nl2);
      range.insertNode(blc);
      range.insertNode(nl);
   }
}

//Handles all the events of the table
function tableController(tbl) {
   var rIcon = document.createElement('SPAN');
   rIcon.setAttribute('class','addRowIcon');
   rIcon.setAttribute('contenteditable', 'false');
   
   var cIcon = document.createElement('SPAN');
   cIcon.setAttribute('class','addColIcon');
   cIcon.setAttribute('contenteditable', 'false');
   resetIconsPosition();

   tbl.appendChild(rIcon);
   tbl.appendChild(cIcon);

   tbl.setAttribute('contenteditable', 'false');
   activateCells();

   tbl.onmousedown = function(event){
      event.stopPropagation();
   }

   //Add Row
   rIcon.onclick = function(){
      var row = tbl.insertRow(tbl.rows.length);
      for (var i = 0; i < tbl.rows[0].cells.length; i++) {
         var cell = row.insertCell(i);
         cell.innerHTML = '&nbsp;';
      }
      activateCells();
      resetIconsPosition();
   };

   //Add Column
   cIcon.onclick = function(){
      for (var i = 0; i < tbl.rows.length; i++) {
         var row = tbl.rows[i];
         var cell = row.insertCell(row.cells.length);
         cell.innerHTML = '&nbsp;';
      }
      activateCells();
      resetIconsPosition();
   };

   function resetIconsPosition(){
      rIcon.style.top = 'calc(100% - 5px)';
      rIcon.style.left = 'calc(50% - 5px)';
      cIcon.style.top = 'calc(50% - 5px)';
      cIcon.style.left = 'calc(100% - 5px)';
   }

   function activateCells() {
      var delIcons = tbl.querySelectorAll('.delIcon');
      [].forEach.call(delIcons, function(icon){
         icon.parentElement.removeChild(icon);
      });

      [].forEach.call(tbl.rows, function(row, index) {
         [].forEach.call(row.cells,function(cell, index) {
            cell.setAttribute('contenteditable', 'true');
            var delIcon = document.createElement('SPAN');
            delIcon.setAttribute('class','delIcon');
            delIcon.setAttribute('contenteditable', 'false');
            delIcon.onclick = function() {
               row.deleteCell(cell.cellIndex);
               if(row.cells.length == 0)
                  tbl.deleteRow(row.rowIndex);
               resetIconsPosition();
            }
            cell.appendChild(delIcon);
            cell.onkeydown = function(event){
               resetIconsPosition();
               if(event.shiftKey && event.ctrlKey && event.code == 'KeyC') {
                  event.stopPropagation();
               }else if(event.shiftKey && event.ctrlKey && event.code == 'KeyL'){
                  event.stopPropagation();
               }else if(event.shiftKey && event.ctrlKey && event.code == 'KeyR'){
                  event.stopPropagation();
               }
            }         
         });
      });
   }
}

//Focus on The Note Content
function focusOnNote() {
   // var noteContent = document.querySelector('.noteContent');
   // noteContent.focus();
}

//Save Note When CTRL+S is pressed
function saveWhileEditing() {
   var noteContainer = document.querySelector('.noteContent');
   var noteContainerClone = noteContainer.cloneNode(true);
   var addRowIcons = noteContainerClone.querySelectorAll('.addRowIcon');
   var addColIcons = noteContainerClone.querySelectorAll('.addColIcon');
   var delIcons = noteContainerClone.querySelectorAll('.delIcon');
   [].forEach.call(addRowIcons, function(icon){
      icon.parentElement.removeChild(icon);
   });
   [].forEach.call(addColIcons, function(icon){
      icon.parentElement.removeChild(icon);
   });
   [].forEach.call(delIcons, function(icon){
      icon.parentElement.removeChild(icon);
   });

   var note = noteContainerClone.innerHTML;
   var textContent = noteContainerClone.textContent;

   if(textContent != "") {

      if(openNote == 0) {

         db.serialize(function() {
            db.run("INSERT INTO NOTE(note, category) VALUES (?,?)", note, selectedCategory, function(err){
               if (err) {
                  // return console.log(err.message);
               } else {
                  getNoteId();
               }
            });

            function getNoteId(){
               db.get("SELECT * FROM NOTE ORDER BY id DESC LIMIT 1", function(err, row){
                  if(row){
                     openNote = row.id;
                     console.log('NEW NOTE ID : '+openNote);
                     db.run("UPDATE LAST_STATE SET note=? WHERE id=?", openNote, 1, function(error){

                     });
                     alterOrderList(openNote);
                  }
               });
            }

            function alterOrderList(openNote){
               var list = document.getElementById('notes');
               var order = [];
               [].forEach.call(list.children, function(element) {
                  var noteID = element.getAttribute('value');
                  if(order.indexOf(noteID) == -1)
                     order.push(noteID);
               });
               order.push(openNote);
               var str = JSON.stringify(order);
               db.run(" UPDATE LAST_ORDER SET _order=? WHERE category=? ",str, selectedCategory, function randomName(err){
                  if (err) {
                     // return console.log(err.message);
                  }
               });
            }

         });

      } else {
         db.run("UPDATE NOTE SET note=? WHERE id=?", note, openNote, function(err){
            if (err) {
               // return console.log(err.message);
            }
         });
      }
   }
}