const mongoose = require('mongoose');

const HorarioSchema = new mongoose.Schema({
    fechaExportacion: { type: Date, default: Date.now },
    horariosProfesores: { type: Object, required: true },
    horariosGrupales: { type: Object, required: true }
})

module.exports = mongoose.model("Horario", HorarioSchema);