const express = require('express');
const path = require('path');
const mysql = require("mysql");
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const multer = require('multer');
const exphbs = require('express-handlebars');

const hbs = exphbs.create({
  extname: 'hbs',
  helpers: {
      increment: (value) => parseInt(value) + 1,
  }
});


dotenv.config({ path: './.env'}); 

const app = express();
const database = mysql.createConnection({

    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DB
});

const publicDirectory = path.join(__dirname , './public');
app.use(express.static(publicDirectory)) 

app.use(express.urlencoded({extended: true})); 
app.use(express.json());

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

app.set('view engine', 'hbs'); 



database.connect( (error) => {

      if(error){
        console.log(error)
      }
      else{
        console.log("MYSQL Connected Successfully")
      }
});

app.listen(202 , () => {

  console.log("Server started on port 202");
});




app.use('/',require('./routes/pages'));


app.post("/createAccount" , (req , res ) => {

  const { name , surname , email , password , confirmPassword } = req.body;

  database.query('SELECT email FROM users WHERE email = ?', [email] , async (error , results) => {

      if(error){
        console.log(error)
      }
      if(results.length > 0){

           return res.render('createAccount' , {
              message: 'User already exist'
           });
      } 

      else{

          if(password !== confirmPassword){

              return res.render('createAccount' , {
                message: 'Password does not match'
             });
          }
      }

 
      let handPassword = await bcrypt.hash(password , 8); //encypt password

      database.query('INSERT INTO users SET ?' , {name: name, surname: surname, email: email, password: password} , (error , results) => {

          if(error){

              console.log(error)
          }
          else{

            return res.render('signInUp' , {
              message: 'Email already in use .'
           });
          }

      });

  });

  console.log(req.body);
  

});

//Login User
app.post("/signin" , async(req, res ) => {

     const { email , password } = req.body;
    
    database.query('SELECT * from users WHERE email = ? and password = ?', [email , password] ,async (error,results,fields) =>{

          if(results.length > 0){

                if(error) throw error;

                 req.session.email = email;
                 req.session.name = results[0].name;
                 req.session.surname = results[0].surname;

                 sName = req.session.name;
                 sSurname = req.session.surname;

                 //res.render('profile' , {email}),
                 res.render('homepage' , {sName,sSurname});
           }
           else{
            
              const errMessage = "Incorrect Login Details";
              res.render('signInUp' , {errMessage}); 
           }

      });

});

//Delete Account
app.post("/deleteAccount" , async(req,res)=>{


  const email = req.session.email;
  const password = req.body.password;

  database.query('SELECT * from users WHERE email = ? and password = ?', [email , password] ,async (error,results,fields) =>{

    if(results.length > 0){

           const pass= results[0].password;

           if(pass == password){

            database.query('DELETE FROM users WHERE email = ? and password = ? ' , [email,password], (error,results) => {

              res.redirect("/createAccount");


            });

          }

  

     }

     else{

      console.log("incorrect password");
       res.redirect("/deleteAccount");

     }

});


});


//Update Account
app.post("/updateAccount" , async (req,res) => {

      let {name , surname , email } = req.body;
      const updateEmail = req.session.email;

      //check which one to update
      if(name == ""){

           name = req.session.name;

      }
      if(surname == ""){

         surname = req.session.surname;

      }

      if(email == ""){

           email = req.session.email;
      }

      //set the details of the session

      req.session.email = email;
      req.session.name = name;
      req.session.surname = surname;

      //update the details in the database
      database.query('UPDATE users SET name = ? WHERE email = ?' , [name,updateEmail]);
      database.query('UPDATE users SET surname = ? WHERE email = ?' , [surname,updateEmail]);
      database.query('UPDATE users SET email = ? WHERE email = ?' , [email,updateEmail]);

      res.redirect("/updateAccount");

});


app.post('/loginAdmin', (req, res) => {
  const { email, password } = req.body;

  const query = 'SELECT * FROM admins WHERE email = ? AND password = ?';
  database.query(query, [email, password], (err, results) => {
    if (err) {
      return res.status(500).send({ error: err.message });
    }

    if (results.length > 0) {
      // Successful login
      res.redirect("/adminCategories");
    } else {
      // Invalid credentials
      res.status(401).send('Invalid email or password');
    }
  });
});

function renderViewUsersPage(req, res) {
  // Query users from the database
  database.query('SELECT * FROM users order by name', (error, results) => {
    if (error) {
      
      return res.status(500).send('Error retrieving users from database');
    }
    
    // Render the viewUsers page and pass the users data to the template
    res.render('viewUsers', { users: results });
  });
}

app.get('/viewUsers', renderViewUsersPage);

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
      cb(null, 'public/uploads');
  },
  filename: function(req, file, cb) {
      cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const audioStorage = multer.diskStorage({
  destination: function(req, file, cb) {
      cb(null, 'public/uploads'); 
  },
  filename: function(req, file, cb) {
      cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const audioUpload = multer({ storage: audioStorage });


const upload = multer({ storage: storage });

app.post('/addEntry', audioUpload.fields([{ name: 'image', maxCount: 1 }, { name: 'audio', maxCount: 1 }]), (req, res) => {
  const { name, description, category_id, language_id } = req.body;
  const imagePath = req.files['image'] ? '/uploads/' + req.files['image'][0].filename : "C:\Users\User\Downloads\node-app1\node-app\public\images"; // Construct image path
  const audioPath = req.files['audio'] ? '/uploads/' + req.files['audio'][0].filename : "C:\Users\User\Downloads\node-app1\node-app\public\audio"; // Construct audio path if an audio file is uploaded

  
  const sql = 'INSERT INTO Entry (name, description, image, audio, category_id, language_id) VALUES (?, ?, ?, ?, ?, ?)';
  const values = [name, description, imagePath, audioPath, category_id, language_id];

  
  database.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error inserting entry:', err);
      res.status(500).send('Error adding entry');
    } else {
      console.log('Entry added successfully');
      res.redirect('/adminCategories'); 
    }
  });
});


app.get('/deleteEntry/:id', (req, res) => {
  const entryId = req.params.id;

  
  database.query('DELETE FROM Entry WHERE id = ?', [entryId], (error, result) => {
    if (error) {
      console.error('Error deleting entry:', error);
      res.status(500).send('Error deleting entry');
    } else {
      console.log('Entry deleted successfully');
      res.redirect('/viewEntries');
    }
  });
});

app.get('/updateEntry/:id', (req, res) => {
  const entryId = req.params.id;

 
  database.query('SELECT * FROM Entry WHERE id = ?', [entryId], (error, result) => {
    if (error) {
      console.error('Error fetching entry details:', error);
      res.status(500).send('Error fetching entry details');
    } else {
      
      res.render('updateEntry', { entry: result[0] });
    }
  });
});


app.post('/updateEntry/:id', upload.single('image'), (req, res) => {
  const entryId = req.params.id;
  const { name, description, category_id, language_id } = req.body;
  let imagePath = req.body.imagePath; 

 
  if (req.file) {
    imagePath = '/uploads/' + req.file.filename; 
  }

  
  const sql = 'UPDATE Entry SET name = ?, description = ?, image = ?, category_id = ?, language_id = ? WHERE id = ?';
  const values = [name, description, imagePath, category_id, language_id, entryId];

  
  database.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error updating entry:', err);
      res.status(500).send('Error updating entry');
    } else {
      console.log('Entry updated successfully');
      res.redirect('/viewEntries'); 
    }
  });
});



app.get('/logout', (req, res) => {
  // Destroy the session
  req.session.destroy((err) => {
      if (err) {
          console.error(err);
          return res.redirect('/admin'); 
      }
      res.redirect('/homePage'); 
  });
});



