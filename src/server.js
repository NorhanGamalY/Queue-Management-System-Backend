const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

connectDB();

const port = process.env.PORT || 3000;

app.listen(port, ()=>{
    console.log(`Listening on port --> http://localhost/${port}`);
})