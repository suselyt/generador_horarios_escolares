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
  const { bloques_matutino, bloques_vespertino, bloque_inicio_vespertino } = config;

  const totalBloques = bloques_matutino + bloques_vespertino;
  let bloqueActual = 1;

  for (let dia of dias) {
    matriz[dia] = {};
    for (let i = 0; i < totalBloques; i++){
      matriz[dia][bloqueActual] = null;
      bloqueActual++;
    }
    bloqueActual = 1;
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
  let materiaActual = materias[indexMateria];
  let horasRestantes = materiaActual.horas_semanales;
  let nombreMateria = materiaActual.nombre;
  let tipoMateria = materiaActual.tipo;

  const dias = Object.keys(matriz); // los days of the week que se usan como keys en la matriz

  while (indexMateria < materias.length){
    let seAsignoHoraEstaVuelta = false;

    for (let dia of dias) {
      const bloquesEnDia = matriz[dia]; 
      let horasAsignadasHoy = 0;

      for (let bloqueStr in bloquesEnDia) {
        const bloque = parseInt(bloqueStr);
        if (bloquesEnDia[bloque] === nombreMateria && esBloqueDelTurno(bloque, grupo.turno, config)) {
          horasAsignadasHoy++;
        }
      }

      const maximoPorDia = maximoHorasDeMateriaPorDia(materiaActual);

        for (let bloqueStr in bloquesEnDia) {
          const bloque = parseInt(bloqueStr);
          if (bloquesEnDia[bloque] === null && horasAsignadasHoy < maximoPorDia && esBloqueDelTurno(bloque, grupo.turno, config)) {
            bloquesEnDia[bloque] = nombreMateria;
            horasRestantes--;
            horasAsignadasHoy++;
            seAsignoHoraEstaVuelta = true;

            if (horasRestantes === 0) {
              break; // salir del día
            }
          }
        }
      if (horasRestantes === 0) break;
    }
    if (horasRestantes === 0) {
      indexMateria++;
      if (indexMateria < materias.length) {
        materiaActual = materias[indexMateria];
        nombreMateria = materiaActual.nombre;
        tipoMateria = materiaActual.tipo;
        horasRestantes = materiaActual.horas_semanales;
      }
    } else if (!seAsignoHoraEstaVuelta) {
      // no se pudo asignar nada más y aún hay horas restantes
      console.warn(`No se pudo asignar todas las horas de "${nombreMateria}"`);
      indexMateria++; // cambio de materia
      if (indexMateria < materias.length) {
        materiaActual = materias[indexMateria];
        nombreMateria = materiaActual.nombre;
        tipoMateria = materiaActual.tipo;
        horasRestantes = materiaActual.horas_semanales;
      }
    }
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
      if (bloquesDia[bloque] === null && bloquesAsignados < bloquesDelDia){
        bloquesDia[bloque] = nombre;
        bloquesAsignados++;
      }
    }
  }

  return matriz;
}

// primero asigna las materias extracurriculares al final de la semana
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
      if (matriz[dia][bloque] === null && horasAsignadasHoy < maximoPorDia) {
        matriz[dia][bloque] = nombre;
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