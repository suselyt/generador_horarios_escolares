const mongoose = require('mongoose');

async function conectarDB() {
    try {
        await mongoose.connect('mongodb://localhost:27017/horariosDB', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('CONNNECTEADO A MONGODB')
    }
    catch {
        console.error('ERRORRR CON CONEXION:', error);
        process.exit(1);
    }
}

module.exports = conectarDB;
