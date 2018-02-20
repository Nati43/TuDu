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


//GLOBAL FLAGS
var selectedCategory = 0;
var scrollFlag = false;
var successFlag = false;
var addedOnEmpty = false;
var uiState = "DARK";


//Loads all the categories at startup
function taskLoader(){
   
   var tHandle = setInterval(function(){

      if(dbFlag) {
         clearInterval(tHandle);

         console.log("Connected to DB!");

         db.get("SELECT category FROM LAST_SELECTED_CATEGORY ORDER BY id DESC LIMIT 1", function(err, row) {
            // selectedCategory = row.category;
            if(row)
               selectedCategory = row.category;
            uiLoader();
            // proceedLoading();
            // console.log('SELECTED CATEGORY : '+selectedCategory);
            if(selectedCategory == 0) {
               // console.log("NO CATEGORIES");
               document.querySelector('.menuTogglerBody').click();
               popup();
               document.getElementById('closePopupBtn').style.pointerEvents = 'none';
               document.getElementById('closePopupBtn').style.textDecoration = 'line-through';
            } else {
               loadCategories();
               loadTasksToCategory();
            }

         });

      }else {
         // console.log("Sorry! No db Found!");
      }
   }, 10);
}


//To load all the categories in the Database
function loadCategories(){

   if(document.getElementById('closePopupBtn').style.pointerEvents == 'none' && document.getElementById('closePopupBtn').style.textDecorationLine == 'line-through') {
      document.getElementById('closePopupBtn').style.pointerEvents = 'initial';
      document.getElementById('closePopupBtn').style.textDecoration = 'initial';
   }

   var categoryList = document.querySelector('.categoryList');
   db.each("SELECT id, category FROM CATEGORY", function(err, row) {
      var category = document.createElement('LI');
      category.setAttribute('class','category');
      category.setAttribute('categoryId',row.id);
      category.style.position = 'relative';

      if(selectedCategory == row.id){
         if(uiState == "TRANSPARENT")
            category.classList.add('activeTransparent');
         else
            category.classList.add('active');
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

      category.onclick = function(event){categorySelector(event);};
      categoryList.appendChild(category);
   });
}

//Fired when a category is selected
function categorySelector(event) {

   if(event.srcElement.getAttribute('categoryId') != selectedCategory){
      
      var cls = 'active';
      if(uiState == 'TRANSPARENT')
         cls = 'activeTransparent';

      var categories =  document.querySelectorAll('.category');
      for(var i=0; i<categories.length; i++){
         categories[i].classList.remove(cls);
      }

      event.srcElement.classList.add(cls);
      selectedCategory = event.srcElement.getAttribute('categoryId');
      db.run("INSERT INTO LAST_SELECTED_CATEGORY(category) VALUES(?)", selectedCategory, function(error){
         if(error == null){
            // console.log('LAST_SELECTED_CATEGORY ALTERED');
         }
      });
      loadTasksToCategory();
   }
   document.querySelector('.menuTogglerNav').click();
}

//Fired when the delete category icon is clicked
function categoryDeleter(event, obj) {
   event.stopPropagation();
   var category = obj.parentElement;
   var categoryId = category.getAttribute('categoryId');

   // console.log("Trying to Delete category "+categoryId);

   db.serialize(function(){

      db.run("DELETE FROM LAST_SELECTED_CATEGORY WHERE category="+categoryId, function(err){
         if(err){
            // console.log(err);
         }
      });

      db.run("DELETE FROM CATEGORY WHERE id=?",categoryId, function(err){
         if(err){
            // console.log(err);
         }else{
            category.style.transform = "translateX(-200vw)";
            setTimeout(function(){
               category.parentElement.removeChild(category);
            }, 250);
            cleanUp();
         }
      });

      function cleanUp(){
         db.run("DELETE FROM TASK WHERE category=?",categoryId, function(err){
            if(err){
               // console.log(err);
            }else{
               step2();
            }
         });

         function step2(){
            db.run("DELETE FROM LAST_ORDER WHERE category=? ", categoryId, function(err){
               if(err){
                  // console.log(err);
               }else{
                  proceed();
               }
            });
         }

         function proceed(){

            db.get("SELECT COUNT(*) AS num FROM CATEGORY", function(err, row){
               if(row.num == 0){
                  var tks = document.querySelectorAll('.task');
                  for(var i=0; i<tks.length; i++){
                     tks[i].parentElement.removeChild(tks[i]);
                  }
                  selectedCategory = 0;
                  popup();
                  document.getElementById('closePopupBtn').style.pointerEvents = 'none';
                  document.getElementById('closePopupBtn').style.textDecorationLine = 'line-through';
               } else {
                  if(selectedCategory == categoryId)
                     selectOtherCategory();
               }
            });

            function selectOtherCategory(){
               db.get("SELECT id FROM CATEGORY ORDER BY id ASC LIMIT 1", function(err, row){
                  selectedCategory = row.id;
                  saveNewlySelectedCategory();
               });
            }

            function saveNewlySelectedCategory(){
               db.run("INSERT INTO LAST_SELECTED_CATEGORY(category) VALUES(?)", selectedCategory, function(error){
                  if(error == null){
                     // console.log('LAST_SELECTED_CATEGORY ALTERED');
                     loadTasksToCategory();
                     if(uiState == "TRANSPARENT")
                        document.querySelector('.category[categoryId="'+selectedCategory+'"]').classList.add('activeTransparent');
                     else
                        document.querySelector('.category[categoryId="'+selectedCategory+'"]').classList.add('active');
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

         db.get("SELECT COUNT(*) AS num FROM CATEGORY", function(err, row){
            if(err == null){
               if(row && row.num == 0)
                  addedOnEmpty = true;
               proceed();
            }
         });

         function proceed(){
            db.serialize(function() {
               db.run("INSERT INTO CATEGORY(category) VALUES (?)",category,function(err){
                  if (err) {
                     // return console.log(err.message);
                  }
                  // console.log("INSERTED CATEGORY");
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

      if(addedOnEmpty){
         db.run("INSERT INTO LAST_SELECTED_CATEGORY(category) VALUES(?)", newID, function(error){
            if(error == null){
               // console.log('LAST_SELECTED_CATEGORY ALTERED');
            }
         });
      }
      db.run("INSERT INTO LAST_ORDER(category, _order) VALUES(?, ?)", newID, "[]", function(err){
         // console.log("CATEGORY ADDED TO ORDER LIST");
         if(selectedCategory == 0){
            // console.log("ADDED ON EMPTY");
            // console.log("SELECTED CATEGORY :"+newID);
            selectedCategory = newID;
         }
         closePopup();
         loadCategories();
      });

   });
}


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

   if(event.key == "Enter" && addField.value != "") {
      event.preventDefault();

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

            if(tasks.children.length == 1) {
               if(tasks.querySelector('.Indicator'))
                  tasks.removeChild(tasks.querySelector('.Indicator'));
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

   if(document.querySelector('.activeTransparent') && uiState == 'TRANSPARENT'){
      document.querySelector('.activeTransparent').classList.add('active');
      document.querySelector('.activeTransparent').classList.remove('activeTransparent');
   }else if(document.querySelector('.active')) {
      document.querySelector('.active').classList.add('activeTransparent');
      document.querySelector('.active').classList.remove('active');      
   }

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
            if(document.querySelector('.active')){
               document.querySelector('.active').classList.add('activeTransparent');
               document.querySelector('.active').classList.remove('active');               
            }
            document.querySelector('.popup').classList.add('popupTransparent');
            document.querySelector('.popupBtn').classList.add('popupBtnTransparent');
            document.getElementById('closePopupBtn').classList.toggle('popupBtnTransparent');
            document.getElementById('themeCheckbox').checked  = true;
         }
      }
   });
}


