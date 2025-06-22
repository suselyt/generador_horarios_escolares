const { log } = require('console');
const fs = require('fs'); //modulo para leer archivos

// leer archivos json con info que estoy usando
const materias = JSON.parse(fs.readFileSync("materias.json", "utf8"));
const grupos = JSON.parse(fs.readFileSync("grupos.json", "utf8"));
const profesores = JSON.parse(fs.readFileSync("profesores.json", "utf8"));


// crea la matriz vacia para cada turno de un semestre, depende del turno pone 7 u 8 bloques
function crearMatrizHorario(grupo) {
  const bloquesPorTurno = { //objeto de los turnous para acceder al num de bloq en turno
    "Matutino": {
      bloques: 8
    },
    "Vespertino": {
      bloques: 7
    }
  };

  const dias = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"];
  const turno = bloquesPorTurno[grupo.turno];

  if (!turno) throw new Error("Turno no válido: " + grupo.turno); //validacion de turno

  const bloques = turno.bloques;
  const matriz = {};

  dias.forEach(dia => {
    matriz[dia] = {}; // nuevo objeto llamado dia para poder acceder usando matriz["Lunes"][1]
    for (let i = 1; i <= bloques; i++) {
      matriz[dia][i] = null;
    }
  });

  return matriz;
}


function filtrarMateriasPorSemestre(materias, semestre) {
  return materias.filter(materia => 
 materia.semestre === undefined || //materias que no tienen semestre definido como tutorias 
    materia.semestre === semestre 
  );
}


function asignarMateriasAMatriz(matriz, materias) {
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

      for (let bloque in bloquesEnDia) {
        if (bloquesEnDia[bloque] === nombreMateria) {
          horasAsignadasHoy++;
        }
      }

      const maximoPorDia = maximoHorasDeMateriaPorDia(materiaActual);

        for (let bloque in bloquesEnDia) {
        if (bloquesEnDia[bloque] === null && horasAsignadasHoy < maximoPorDia) {
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

    for (let bloque in bloquesDia) {
      if (bloquesDia[bloque] === null && bloquesAsignados < bloquesDelDia){
        bloquesDia[bloque] = nombre;
        bloquesAsignados++;
      }
    }
  }

  return matriz;
}

// primero asigna las materias extracurriculares al final de la semana
function acomodoExtracurricularesAlFinal(matriz, materiaExtracurricular) {
  const dias = Object.keys(matriz);
  const nombre = materiaExtracurricular.nombre;
  let horasRestantes = materiaExtracurricular.horas_semanales;
  const maximoPorDia = maximoHorasDeMateriaPorDia(materiaExtracurricular);

  for (let dia of dias) {
    const bloques = Object.keys(matriz[dia]).reverse(); // empieza desde el final del dia
    let horasAsignadasHoy = 0;

    for (let bloque of bloques) {
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




// PRUEBA DEL ALGORÍTMO ------------------------------- usa "node.js algoritmo.js" en terminal
const grupo = grupos[0]; //escoger un grupo de grupos.json
const matriz = crearMatrizHorario(grupo); //crea la matriz dependiendo del turno del grupo
const materiasDelGrupo = filtrarMateriasPorSemestre(materias, grupo.semestre);

const moduloProfesional = materiasDelGrupo.find(m => m.tipo === "modulo_profesional") //busca las materias del tipo modulo profesional que corresponde al semestre

if (moduloProfesional) { // si hubo al menos una de tipo modulo profesional
  acomodoPreferenteModuloProfesional(matriz, moduloProfesional); 
}

const extracurriculares = materiasDelGrupo.filter(m => m.tipo === "extracurricular");
extracurriculares.forEach(m => acomodoExtracurricularesAlFinal(matriz, m));

const otrasMaterias = materiasDelGrupo.filter(m =>
  m.id !== moduloProfesional?.id && m.tipo !== "extracurricular"
);

asignarMateriasAMatriz(matriz, otrasMaterias);

console.log(matriz);



// CAMBIOS QUE AGREGAR PARA DESPUES >
//          agregar recesos para la matriz // tal vez no haga falta y se pueda hacer en el front
//          agregar profesores a las materias
//          validaciones
//          turno vespertino cambiar los bloques empiecen despues del 8
//          asignar horas preferentes para los maestros en json y tener en cuenta al asignar
//          hacer que los maestros tengan horario seguido

// ERROR CON ULTIMO COMMIT> aun falla en agregar ciertas materias, hacer que recorra las materias y primero 
//                          asigne de forma preferencial, es decir, si el maximo es 2, asignar esas 2 donde se pueda

// DUDAS>
//         los del turno vespertino tienen horas extracurriculares?