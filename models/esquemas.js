const mongoose = require('mongoose');
const { Schema } = mongoose;

// Materia
const MateriaSchema = new Schema({}, { strict: false });

// Profesor (adaptado para referencias)
const ProfesorSchema = new Schema({
  materias: [
    {
      materia: { type: Schema.Types.ObjectId, ref: 'Materia' },
      grupos_preferidos_asignar: [String]
    }
  ]
}, { strict: false });

// Grupo
const GrupoSchema = new Schema({}, { strict: false });

// Config
const ConfigSchema = new Schema({}, { strict: false });

module.exports = {
  Materia: mongoose.model('Materia', MateriaSchema, 'materias'),
  Profesor: mongoose.model('Profesor', ProfesorSchema, 'profesores'),
  Grupo: mongoose.model('Grupo', GrupoSchema, 'grupos'),
  Config: mongoose.model('Config', ConfigSchema, 'config')
};
