const { log } = require('console');
const fs = require('fs'); //modulo para leer archivos

// leer archivos json con info que estoy usando
const materias = JSON.parse(fs.readFileSync("materias.json", "utf8"));
const grupos = JSON.parse(fs.readFileSync("grupos.json", "utf8"));
const profesores = JSON.parse(fs.readFileSync("profesores.json", "utf8"));


// crea la matriz vacia para cada turno de un semestre, depende del turno pone 7 u 8 bloques
// cada bloque dura 50 minutos predeterminado
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
  let horasRestantes = materias[indexMateria].horas_semanales;
  let nombreMateria = materias[indexMateria].nombre;

  const dias = Object.keys(matriz); // los days of the week

  for (let dia of dias) {
    const bloquesEnDia = matriz[dia];

    for (let bloque in bloquesEnDia) {
      if (bloquesEnDia[bloque] === null) {
        bloquesEnDia[bloque] = nombreMateria;
        horasRestantes--;

        if (horasRestantes === 0) {
          indexMateria++;
          if (indexMateria >= materias.length) return matriz; // ya no hay más materias
          nombreMateria = materias[indexMateria].nombre;
          horasRestantes = materias[indexMateria].horas_semanales;
        }
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

// restricciones de la asignación
function maximoHorasDeMateriaPorDia(materia){

  const horasPorMateria {
    "modulo_profesional": 4, // máximo de horas por día para modulo profesional
    "tronco_comun": 2, // máximo de horas por día para tronco común
    "extracurricular": 1 // máximo de horas por día para extracurricular
  };
}

// PRUEBA DEL ALGORÍTMO -------------------------------
const grupo = grupos[0]; //escoger un grupo de grupos.json
const matriz = crearMatrizHorario(grupo); //crea la matriz dependiendo del turno del grupo
const materiasDelGrupo = filtrarMateriasPorSemestre(materias, grupo.semestre);

const moduloProfesional = materiasDelGrupo.find(m => m.tipo === "modulo_profesional") //busca las materias del tipo modulo profesional que corresponde al semestre

if (moduloProfesional) {
  acomodoPreferenteModuloProfesional(matriz, moduloProfesional); //en un futuro poner alguna validación de si es 1er semestre no ejecute esto?
}
const otrasMaterias = materiasDelGrupo.filter(m => m.id !== moduloProfesional?.id);

asignarMateriasAMatriz(matriz, otrasMaterias);

console.log(matriz);




// agregar recesos para la matriz?
// validaciones-

//turno vespertino cambiar los bloques que continuen después 8



//funciones anteriores
// function validarAsignacion(profesor, materia, horario) {
//     // horas máximas
//     if (profesor.horas_asignadas + materia.horas_semanales > profesor.horas_maximas) {
//         return false;
//     }
    
//     // si puede dar la materia
//     if (!profesor.materias.includes(materia.id)) {
//         return false;
//     }
    
//     return true;
// }

// function generarHorario(materias, horasPorDia = 8, dias = 5) {
//   const horario = Array.from({ length: dias }, () => 
//     Array(horasPorDia).fill(null)
//   ); 

//  //ordenar las materias de mayor a menor pq es m'as sencillo asignar las de mayor carga primero
//   const materiasOrdenadas = [...materias].sort((a, b) =>  //sort comparator
//     b.horas_semanales - a.horas_semanales
//   );

//   for (const materia of materiasOrdenadas) {
//     let horasAsignadas = 0;
    
//     //si la materia es de tronco común, tiene un máximo de 2 hrs por día
    
//     //si la materia es de tipo extracurricular, asignar 1 hora por día y en las ultimas horas
    

//     // Intentar asignar en bloques consecutivos primero
//     for (let dia = 0; dia < dias && horasAsignadas < materia.horas_semanales; dia++) {
//       for (let hora = 0; hora < horasPorDia && horasAsignadas < materia.horas_semanales; hora++) {
//         if (horario[dia][hora] === null) {
//           // Intentar bloque de 2 horas si es posible
//           const horasDisponibles = Math.min(2, materia.horas_semanales - horasAsignadas);
//           let bloqueValido = true;
          
//           // Verificar si hay espacio para el bloque
//           for (let h = 0; h < horasDisponibles; h++) {
//             if (hora + h >= horasPorDia || horario[dia][hora + h] !== null) {
//               bloqueValido = false;
//               break;
//             }
//           }
          
//           if (bloqueValido) {
//             for (let h = 0; h < horasDisponibles; h++) {
//               horario[dia][hora + h] = materia.nombre;
//             }
//             horasAsignadas += horasDisponibles;
//             hora += horasDisponibles - 1; // Saltar horas asignadas
//           } else if (horasDisponibles === 1) {
//             // Asignar solo 1 hora si no cabe el bloque
//             horario[dia][hora] = materia.nombre;
//             horasAsignadas += 1;
//           }
//         }
//       }
//     }
    
//     if (horasAsignadas < materia.horas_semanales) {
//       console.warn(`No se asignaron todas las horas para ${materia.nombre} (${horasAsignadas}/${materia.horas_semanales} horas)`);
//     }
//   }

//   return horario;
// }

// function mostrarHorarioHorizontal(horario) {
//   const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  
//   console.log("\nHORARIO ESCOLAR");
//   console.log("===============\n");
  
//   // Encabezado con días
//   let header = "Hora   |";
//   dias.forEach(dia => {
//     header += ` ${dia.padEnd(20)}|`;
//   });
//   console.log(header);
//   console.log("-".repeat(header.length));

//   // Filas por hora
//   for (let hora = 0; hora < horario[0].length; hora++) {
//     let fila = `${(hora + 1 + "ª").padEnd(6)}|`;
    
//     for (let dia = 0; dia < dias.length; dia++) {
//       const texto = horario[dia][hora] || "Libre";
//       fila += ` ${texto.padEnd(20)}|`;
//     }
    
//     console.log(fila);
//     console.log("-".repeat(header.length));
//   }
// }

// Ejemplo de uso
// const materias1ro = filtrarMateriasPorSemestre(materias, 1);
// const horario1ro = generarHorario(materias1ro);
// mostrarHorarioHorizontal(horario1ro);


