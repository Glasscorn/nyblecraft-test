const express = require('express')
const multer = require('multer')
const mysql2 = require('mysql2/promise')
const bodyParser = require('body-parser')
const fs = require('fs')

const pool = mysql2.createPool({
    host: 'eu-cdbr-west-02.cleardb.net',
    user: 'bd9d0a8be9627e',
    database: 'heroku_c7a165ef4d4072c',
    password: '91a457cb'
})

let PDFDocument = require('pdfkit')

const PORT = process.env.PORT || 3000

const app = express()

app.use(express.static(__dirname))
app.use(bodyParser.urlencoded())
app.use(multer({dest:"uploads"}).single("image"))
app.use(express.json())
app.use((req,res,next) => {
    const auth = {login: 'admin', password: '[jxedye,ktrhfan'}
    const b64auth = (req.headers.authorization || '').split(' ')[1] || ''
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':')
    if (login && password && login === auth.login && password === auth.password) {
      return next()
    }
    res.set('WWW-Authenticate', 'Basic realm="401"')
    res.status(401).send('Check auth at ')
  })


app.get('/addUser', (req,res) => {
    res.send(`
        <form method="post" action="add">
            <input type="email" minLength="5" placeholder="E-mail" name="email" required/>
            <input type="text" minLength="2" placeholder="First name" name="firstName" required/>
            <input type="text" minLength="2" placeholder="Last name" name="lastName"/>
            <button type="Submit">Add</button>
            <button type="Cancel"><a href="/main">Cancel</a></button>
        </form>
    `)
})

app.get('/main', (req,res) => {
    pool.query('SELECT * FROM names').then(data => {
        const names = data[0]
        res.send(`
                <a href="/addUser">Add user</a>
                <ul>
                    ${names.map(el => `<li>${el.firstName  == 'undefined' ? '' : el.firstName}
                    ${el.lastName  == 'undefined' ? '' : el.lastName}
                    - ${el.email  == 'undefined' ? '' : el.email}
                    ${el.image  == 'undefined' || el.image == ''  ? '' : `<img style="width: 50px; border-radius: 25px" src="./uploads/${el.image}" alt="No avatar">`}
                    <button><a href="/update/${el.id}">Update</a></button>
                    <button><a href="/setAvatar/${el.id}">Set Avatar</a></button>  
                    <button><a href="/pdf/${el.id}">Create PDF</a></button></li>
                    <button><a href="/delete/${el.id}">Delete</a></button></li>`).join('')}
                </ul>
        `)
    })
})

app.get('/setAvatar/:id', async (req,res) => {
    const data = await pool.query(`SELECT * FROM names WHERE id = ${req.params.id}`).then(data => data[0][0])
    res.send(`
            <p>Image Upload</p>
            <form method="post" action="/upload/${req.params.id}" enctype="multipart/form-data">
            <input type="file" name="image" required/>
            <button type="submit" name="upload">Upload</button>
            </form>
    `)
})
app.post('/upload/:id', async (req,res,next) => {
    await pool.query(`UPDATE names SET
        image = "${req.file.filename}"
        WHERE id = ${req.params.id}`
    )
    res.redirect('/main')
})

app.get('/pdf/:id', async (req,res) => {
    const data = await pool.query(`SELECT * FROM names WHERE id = ${req.params.id}`).then(data => data[0][0])
    if(data.image){
        let doc = new PDFDocument()
        await doc.pipe(fs.createWriteStream(`pdf/${data.id}_${data.firstName}_${data.lastName}.pdf`))
        await doc.image(`./uploads/${data.image}`,100,100,{align: 'center'})
        await doc.text(`${data.firstName} ${data.lastName}`)
        await doc.end()
        res.send(`<a href="${data.id}_${data.firstName}_${data.lastName}.pdf" target="_blank">Open</a>`)
    } else {
        res.send(`<p>Error - Empty avatar<br><a href="/setAvatar/${data.id}">Set</a><br><a href="/main">Back</a></p>`)
    }
})

app.post('/add', async (req,res) => {
    const { email,firstName,lastName } = req.body
    await pool.query('INSERT INTO names SET ?', {
        email: email,
        firstName: firstName,
        lastName: lastName
    })
    res.redirect('/main')
})

app.get('/delete/:id', async (req,res) => {
    await pool.query('DELETE FROM names WHERE id = ?', req.params.id)
    res.redirect('/main')
})

app.get('/update/:id', async (req,res) => {
    const { email,firstName,lastName } = await pool.query(`SELECT * FROM names WHERE id = ${req.params.id}`).then(data => data[0][0])
    const prev_data = await pool.query(`SELECT * FROM names WHERE id = ${req.params.id}`).then(data => data[0][0])
    res.send(`
        <form method="post" action="/update/${req.params.id}">
            <label>${email == "undefined" ? "First name" : email}
                <input type="email" minLength="5" placeholder="E-mail" name="email" value="${prev_data.email == 'undefined' ? '' : prev_data.email}"/>
            </label>
            <label>${firstName == "undefined" ? "First name" : firstName}
                <input type="text" minLength="2" placeholder="First name" name="firstName" value="${prev_data.firstName == 'undefined' ? '' : prev_data.firstName}"/>
            </label>
            <label>${lastName == "undefined" ? "First name" : lastName}
                <input type="text" minLength="2" placeholder="Last name" name="lastName" value="${prev_data.lastName == 'undefined' ? '' : prev_data.lastName}"/>
            </label>
            <button type="Submit">Update</button>
            <button type="Cancel"><a href="/main">Cancel</a></button>
        </form>
    `)
})

app.post('/update/:id', async (req,res) => {
    const { prev_email,prev_firstName,prev_lastName } = await pool.query(`SELECT * FROM names WHERE id = ${req.params.id}`).then(data => data[0][0])
    const { email,firstName,lastName } = req.body
    await pool.query(`UPDATE names SET
        email = "${email == '' || email == 'undefined' ? prev_email : email}",
        firstName = "${firstName == '' || firstName == 'undefined' ? prev_firstName : firstName}",
        lastName = "${lastName == '' || lastName == 'undefined' ? prev_lastName : lastName}"
        WHERE id = ${req.params.id}`,
    {
        email: email,
        firstName: firstName,
        lastName: lastName
    })
    res.redirect('/main')
})

app.listen(PORT, () => console.log(`???????????????? ???? ${PORT}`))