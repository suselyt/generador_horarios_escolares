const mongoose = require('mongoose');
require('dotenv').config();


async function conectarDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
        });
        console.log('CONNNECTEADO A MONGODB ATLAS')
    }
    catch {
        console.error('ERRORRR CON CONEXION:', error);
        process.exit(1);
    }
}

module.exports = conectarDB;
