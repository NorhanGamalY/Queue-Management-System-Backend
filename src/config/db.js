const mongoose = require('mongoose');

const connectDB = async () => {
    try{
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ Database Connected");
    }catch(error){
        console.log("❌ Database connection failed", error);
        process.exit(1);
    }
}

module.exports = connectDB;