const fs = require('fs'); //modulo para leer archivos

const materias = JSON.parse(fs.readFileSync("materias.json", "utf8"));
const grupos = JSON.parse(fs.readFileSync("grupos.json", "utf8"));
const profesores = JSON.parse(fs.readFileSync("profesores.json", "utf8"));
const config = JSON.parse(fs.readFileSync("general.json", "utf8"));


// crea una matriz del horario para los profesores
function crearMatrizHorarioProfesores(config) {
  const dias = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"];
  const matriz = {};
  const { bloques_matutino, bloques_vespertino } = config;

  const totalBloques = bloques_matutino + bloques_vespertino;

  for (let dia of dias) {
    matriz[dia] = {};
    for (let bloque = 1; bloque <= totalBloques; bloque++) {
      matriz[dia][bloque] = {
        materia: null,
        grupo: null,
        semestre: null
      };
    }
  }
  return matriz;
}

// asigna a cada maestro un horario vacío
function crearHorariosProfesores(profesores, config) {
  const horarios = {};
  for (const profesor of profesores) {
    horarios[profesor.nombre] = crearMatrizHorarioProfesores(config);
  }
  return horarios;
}

function obtenerHorasClase(profesor) {
  const totalFortalecimiento  = profesor.horas_fortalecimiento_academico?.reduce(
    (total, entrada) => total + entrada.horas, 0) || 0;
  return profesor.horas_semanales - totalFortalecimiento ;
}

function filtrarMateriasParaProfesor(profesor, materias, semestre) {
  return materias.filter(m =>
    m.semestre === semestre && profesor.materias.includes(m.id)
  );
}

function bloqueDisponible(horario, dia, bloque) {
  return horario[dia][bloque].materia === null;
}

function asignarBloqueProfesor(horario, dia, bloque, materia, grupo) {
  horario[dia][bloque] = {
    materia: materia.nombre,
    grupo: grupo.nomenclatura,
    semestre: grupo.semestre
  };
}

function asignarFortalecimientoAcademico(profesor, horario, config) {
  let fortalecimientoRestante = profesor.horas_fortalecimiento || 0;
  const dias = Object.keys(horario);
  const totalBloques = config.bloques_matutino + config.bloques_vespertino;

  for (const dia of dias) {
    for (let bloque = 1; bloque <= totalBloques; bloque++) {
      if (bloqueDisponible(horario, dia, bloque) && fortalecimientoRestante > 0) {
        horario[dia][bloque].materia = "Fortalecimiento académico";
        fortalecimientoRestante--;
      }
    }
  }
}

function asignarMateriasProfesor(profesor, horario, materias, grupo, config) {
  const horasClase = obtenerHorasClase(profesor);
  let horasAsignadas = 0;

  const dias = Object.keys(horario);
  const materiasParaEsteProfesor = filtrarMateriasParaProfesor(profesor, materias, grupo.semestre);

  for (const materia of materiasParaEsteProfesor) {
    let horasMateria = materia.horas_semanales;
    const maximoPorDia = maximoHorasDeMateriaPorDia(materia);

    for (const dia of dias) {
      let asignadasHoy = 0;

      for (let bloque = 1; bloque <= config.bloques_matutino + config.bloques_vespertino; bloque++) {
        if (
          bloqueDisponible(horario, dia, bloque) &&
          esBloqueDelTurno(bloque, grupo.turno, config) &&
          asignadasHoy < maximoPorDia &&
          horasMateria > 0 &&
          horasAsignadas < horasClase
        ) {
          asignarBloqueProfesor(horario, dia, bloque, materia, grupo);
          horasMateria--;
          horasAsignadas++;
          asignadasHoy++;
        }
      }

      if (horasMateria === 0) break;
    }

    if (horasMateria > 0) {
      console.warn(
        `no se pudieron asignar todas las horas de "${materia.nombre}" para el profesor ${profesor.abreviatura}`
      );
    }
  }

  return horasAsignadas;
}

function verificarCoberturaDeMaterias(profesores, materias, grupos) {
  const cobertura = {};

  for (const grupo of grupos) {
    const materiasDelGrupo = materias.filter(m => m.semestre === grupo.semestre);
    for (const materia of materiasDelGrupo) {
      cobertura[materia.id] = cobertura[materia.id] || 0;
      for (const profe of profesores) {
        if (profe.materias.includes(materia.id)) {
          cobertura[materia.id] += 1;
        }
      }
    }
  }

  return cobertura; // te dice cuántos profesores pueden cubrir cada materia
}

// verificacion para las materias de modulo profesional
function puedeImpartirMateria(profesor, materia) {
  if (materia.tipo === "modulo_profesional") {
    return profesor.materias.includes(materia.id);
  }

  return profesor.materias.some(id => id === materia.id);
}

//funciones que existen tambien en algoritmo.js por ahora
function maximoHorasDeMateriaPorDia(materia){

  const horasPorMateria = {
    "modulo_profesional": 5, // máximo de horas por día para modulo profesional
    "tronco_comun": 2, 
    "extracurricular": 1 
  };

  return horasPorMateria[materia.tipo] || 2;
}

function esBloqueDelTurno(bloque, turno, config) {
  const { bloques_matutino, bloque_inicio_vespertino } = config;

  if (turno === "Matutino") {
    return bloque <= bloque_inicio_vespertino;
  } else if (turno === "Vespertino") {
    return bloque >= bloque_inicio_vespertino;
  }

  return false;
}

// ------- pruebas ------- //
// console.log(crearHorariosProfesores(profesores, config));
// console.log(obtenerHorasClase(profesores[0]));

// const semestre = grupos[0].semestre;
// console.log(filtrarMateriasParaProfesor(profesores[0], materias,semestre));

const horariosProfesores = crearHorariosProfesores(profesores, config);

for (const profesor of profesores) {
  const horario = horariosProfesores[profesor.nombre];

  for (const grupo of grupos) {
    const materiasDelGrupo = materias.filter(m => m.semestre === grupo.semestre);
    asignarMateriasProfesor(profesor, horario, materiasDelGrupo, grupo, config);
  }

  asignarFortalecimientoAcademico(profesor, horario, config);
}

console.log(JSON.stringify(horariosProfesores, null, 2));