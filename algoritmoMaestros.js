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

      const bloquesOrdenados = obtenerBloquesOrdenados(profesor, config);
      for (let bloque of bloquesOrdenados) {
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


function filtrarMateriasParaProfesor(profesor, materias, semestre, grupo) {
  return materias.filter(m => {
    const puedeDar = profesor.materias.includes(m.id) && m.semestre === semestre;

    // si es modulo profesional verifica la especialidad tmb
    if (m.tipo === "modulo_profesional" && grupo?.especialidad) {
      return puedeDar && grupo.especialidad === profesor.especialidad;
    }

    return puedeDar;
  });
}

function bloqueDisponible(horario, dia, bloque) {
  return horario[dia][bloque].materia === null;
}

// obtener las preferencias de bloques para los maestros
function obtenerBloquesOrdenados(profesor, config) {
  const totalBloques = config.bloques_matutino + config.bloques_vespertino;

  let preferidos = profesor.bloques_recomendados_asignar || [];
  let noPreferidos = profesor.bloques_recomendados_no_asignar || [];

  // Los bloques que no están en ninguno van al final como "neutros"
  const todos = Array.from({ length: totalBloques }, (_, i) => i + 1);

  const neutros = todos.filter(b => !preferidos.includes(b) && !noPreferidos.includes(b));

  // Orden: preferidos → neutros → no preferidos
  return [...preferidos, ...neutros, ...noPreferidos];
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


function contarProfesoresPorMateria(profesores, grupos, materias) {
  const resultado = {};

  for (const grupo of grupos) {
    const materiasGrupo = materias.filter(m => m.semestre === grupo.semestre);
    for (const materia of materiasGrupo) {
      resultado[materia.id] = resultado[materia.id] || new Set();

      for (const profe of profesores) {
        if (profe.materias.includes(materia.id)) {
          resultado[materia.id].add(profe.nombre);
        }
      }
    }
  }

  // Convertir a conteo
  const conteo = {};
  for (const clave in resultado) {
    conteo[clave] = resultado[clave].size;
  }

  return conteo;
}

//restricciones de horas seguidas para una materia
function maximoHorasDeMateriaPorDia(materia){

  const horasPorMateria = {
    "modulo_profesional": 5, // máximo de horas por día para modulo profesional
    "tronco_comun": 2, 
    "extracurricular": 1 
  };

  return horasPorMateria[materia.tipo] || 2;
}

// identifica cuando comienza el turno vespertino y cuando sigue siendo el matutino
function esBloqueDelTurno(bloque, turno, config) {
  const { bloques_matutino, bloque_inicio_vespertino } = config;

  if (turno === "Matutino") {
    return bloque <= bloque_inicio_vespertino;
  } else if (turno === "Vespertino") {
    return bloque >= bloque_inicio_vespertino;
  }

  return false;
}

// identifica cuantos grupos llevan la materia para verificar que se cumpla la asignacion
function contarRequerimientosDeMaterias(grupos) {
  const requerimientos = {}; // { MPP1: 10, Fisica: 8 }

  for (const grupo of grupos) {
    for (const materia of grupo.materias) {
      const clave = materia.nombre;
      if (!requerimientos[clave]) {
        requerimientos[clave] = 0;
      }
      requerimientos[clave] += materia.horas_semanales;
    }
  }

  return requerimientos;
}

function verificarHorasDisponiblesVsRequeridas(requerimientos, profesores) {
  const cobertura = {}; // { MPP1: { requeridas: 15, disponibles: 20 } }

  for (const materia in requerimientos) {
    cobertura[materia] = { requeridas: requerimientos[materia], disponibles: 0 };

    for (const profe of profesores) {
      if (profe.materias.includes(materia)) {
        cobertura[materia].disponibles += obtenerHorasClase(profe);
      }
    }
  }

  return cobertura;
}

function verificarCoberturaGeneral(grupos, materias, profesores) {
  const requerimientos = contarRequerimientosDeMaterias(grupos);
  const cobertura = verificarHorasDisponiblesVsRequeridas(requerimientos, profesores);

  console.log("=== Estado de cobertura de materias ===");
  for (const materia in cobertura) {
    const { requeridas, disponibles } = cobertura[materia];
    const status = disponibles >= requeridas ? "suficiente" : "insuficiente";
    console.log(`${materia}: requeridas ${requeridas}, disponibles ${disponibles} → ${status}`);
  }
}


function agruparMateriasPorSemestre(grupos) {
  const conteo = {}; // { 2: {MPP1: 3, Fisica: 3} }

  for (const grupo of grupos) {
    const sem = grupo.semestre;
    if (!conteo[sem]) conteo[sem] = {};

    for (const materia of grupo.materias) {
      if (!conteo[sem][materia.nombre]) conteo[sem][materia.nombre] = 0;
      conteo[sem][materia.nombre]++;
    }
  }

  return conteo;
}

//PRUEBA DE HORARIO
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


//agregar asignación de profesores en horas preferidas
// no se puede repetir una clase al mismo grupo en el día
// una vez que el programa asigna un grupo a un maestro con una materia, no puede asignar ese grupo con esa materia a otro maestro

//agregar campo de si dan dual para los maestros o que se registre un grupo de dual?????
//mejor que se registre un grupo el dual para cada semestre idk