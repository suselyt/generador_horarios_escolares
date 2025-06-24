const { log } = require('console');
const fs = require('fs'); //modulo para leer archivos
const { parse } = require('path');
const { json } = require('stream/consumers');

// leer archivos json con info que estoy usando
const materias = JSON.parse(fs.readFileSync("materias.json", "utf8"));
const grupos = JSON.parse(fs.readFileSync("grupos.json", "utf8"));
const profesores = JSON.parse(fs.readFileSync("profesores.json", "utf8"));
const config = JSON.parse(fs.readFileSync("general.json", "utf8"));


function crearMatrizHorario(config){
  const dias = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"];
  const matriz = {};
  const { bloques_matutino, bloques_vespertino} = config;

  const totalBloques = bloques_matutino + bloques_vespertino;

  for (let dia of dias) {
    matriz[dia] = {};
    for (let bloque = 1; bloque <= totalBloques; bloque++){
      matriz[dia][bloque] = {
        materia: null,
        profesor: null,
        aula: null
      };
    }
  }
  return matriz;
}


function filtrarMateriasPorSemestre(materias, semestre) {
  return materias.filter(materia => 
 materia.semestre === undefined || //materias que no tienen semestre definido como tutorias 
    materia.semestre === semestre 
  );
}


function asignarMateriasAMatriz(matriz, materias, grupo, config) {
  let indexMateria = 0;
  const dias = Object.keys(matriz); // ["Lunes", "Martes", ...]

  while (indexMateria < materias.length) {
    const materiaActual = materias[indexMateria];
    let horasRestantes = materiaActual.horas_semanales;
    const nombreMateria = materiaActual.nombre;
    const maximoPorDia = maximoHorasDeMateriaPorDia(materiaActual);
    const nombreProfesor = asignarProfesorDisponible(materiaActual, profesores);

    let seAsignoHoraEstaVuelta = false;

    for (let dia of dias) {
      const bloquesEnDia = matriz[dia]; 
      let horasAsignadasHoy = 0;

      for (let bloqueStr in bloquesEnDia) {
        const bloque = parseInt(bloqueStr);

        if (bloquesEnDia[bloque].materia === nombreMateria && esBloqueDelTurno(bloque, grupo.turno, config)) {
          horasAsignadasHoy++;
        }
      }

        for (let bloqueStr in bloquesEnDia) {
          const bloque = parseInt(bloqueStr);

          if (bloquesEnDia[bloque].materia === null && horasAsignadasHoy < maximoPorDia && esBloqueDelTurno(bloque, grupo.turno, config)) {
            bloquesEnDia[bloque].materia = nombreMateria;
            bloquesEnDia[bloque].profesor = nombreProfesor;
            horasRestantes--;
            horasAsignadasHoy++;
            seAsignoHoraEstaVuelta = true;

            if (horasRestantes === 0) break
          }
        }

      if (horasRestantes === 0) break;
    }

   if (!seAsignoHoraEstaVuelta) {
      console.warn(`No se pudo asignar todas las horas de "${nombreMateria}"`);
    }

    indexMateria++;
  }
  return matriz;
}

// primero asigna las funciones del modulo profesional de la manera que quería el coordinador
function acomodoPreferenteModuloProfesional(matriz, materiaModulo) {
  const dias = Object.keys(matriz);
  const bloquesRecomendados = materiaModulo.bloques_recomendados;
  const nombre = materiaModulo.nombre;

  for (let i = 0; i < dias.length; i++) {
    const dia = dias[i];
    const bloquesDelDia = bloquesRecomendados[i] || 0;
    const bloquesDia = matriz[dia];

    let bloquesAsignados = 0;

    for (let bloqueStr in bloquesDia) {
      const bloque = parseInt(bloqueStr);
      if (bloquesDia[bloque].materia === null && bloquesAsignados < bloquesDelDia){
        bloquesDia[bloque].materia = nombre;
        bloquesAsignados++;
      }
    }
  }

  return matriz;
}

// primero asigna las materias extracurriculares al final del día
function acomodoExtracurricularesAlFinal(matriz, materiaExtracurricular, grupo, config) {
  const dias = Object.keys(matriz);
  const nombre = materiaExtracurricular.nombre;
  let horasRestantes = materiaExtracurricular.horas_semanales;
  const maximoPorDia = maximoHorasDeMateriaPorDia(materiaExtracurricular);

  for (let dia of dias) {
    // validacion de de turno
    const bloquesValidos = Object.keys(matriz[dia])
    .map(bloqueStr => parseInt(bloqueStr))
    .filter(bloque => esBloqueDelTurno(bloque, grupo.turno, config))
    .sort((a, b) => b - a); // ordena de mayor a menor, o sea el bloque del final

    let horasAsignadasHoy = 0;

    for (let bloque of bloquesValidos) {
      if (matriz[dia][bloque].materia === null && horasAsignadasHoy < maximoPorDia) {
        matriz[dia][bloque].materia = nombre;
        horasRestantes--;
        horasAsignadasHoy++;

        if (horasRestantes === 0) return matriz;
      }
    }
  }

  return matriz;
}

// restricciones de la asignación
function maximoHorasDeMateriaPorDia(materia){

  const horasPorMateria = {
    "modulo_profesional": 5, // máximo de horas por día para modulo profesional
    "tronco_comun": 2, 
    "extracurricular": 1 
  };

  return horasPorMateria[materia.tipo] || 2;
}

function obtenerTurnoDeBloque(bloque, config) {
  const { bloque_inicio_vespertino } = config;
  return bloque < bloque_inicio_vespertino ? "Matutino" : "Vespertino";
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


// usar con la funcion de filtrar materias por grupo
function validarMateriaDeProfesor(materias, profesor){ 
  return profesor.materias.includes(materias.id);

}

function asignarProfesorDisponible(materia,profesores){
for (let profesor of profesores) {
    if (validarMateriaDeProfesor(materias, profesor)) {
      if (profesor.horas_restantes >= materias.horas_semanales) {
        profesor.horas_restantes -= materias.horas_semanales;
        return profesor
      }
    }
  }

  return null; 
}


// PRUEBA DEL ALGORÍTMO ------------------------------- usa "node.js algoritmo.js" en terminal
const grupo = grupos[0]; // selecciona el primer grupo para probar
const matriz = crearMatrizHorario(config); //crea la matriz dependiendo de la config de general.json
const materiasDelGrupo = filtrarMateriasPorSemestre(materias, grupo.semestre);

const moduloProfesional = materiasDelGrupo.find(m => m.tipo === "modulo_profesional") //busca las materias del tipo modulo profesional que corresponde al semestre

if (moduloProfesional) { // si hubo al menos una de tipo modulo profesional
  acomodoPreferenteModuloProfesional(matriz, moduloProfesional); 
}

const extracurriculares = materiasDelGrupo.filter(m => m.tipo === "extracurricular");
extracurriculares.forEach(m => acomodoExtracurricularesAlFinal(matriz, m,grupo,config));

const otrasMaterias = materiasDelGrupo.filter(m =>
  m.id !== moduloProfesional?.id && m.tipo !== "extracurricular"
);

asignarMateriasAMatriz(matriz, otrasMaterias, grupo, config);

console.log(matriz);


// CAMBIOS QUE AGREGAR PARA DESPUES >
//          agregar recesos para la matriz // tal vez no haga falta y se pueda hacer en el front
//          agregar profesores a las materias
//          validaciones
//          asignar horas preferentes para los maestros en json y tener en cuenta al asignar
//          hacer que los maestros tengan horario seguido

// ERROR CON ULTIMO COMMIT> aun falla en agregar ciertas materias, hacer que recorra las materias y primero 
//                          asigne de forma preferencial, es decir, si el maximo es 2, asignar esas 2 donde se pueda

// DUDAS>
//         los del turno vespertino tienen horas extracurriculares?