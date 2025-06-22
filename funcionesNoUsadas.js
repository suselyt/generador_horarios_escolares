// crea la matriz vacia para cada turno de un semestre, depende del turno pone 7 u 8 bloques
// cada bloque dura 50 minutos predeterminado
function crearMatrizHorario(grupo) {
  const bloquesPorTurno = {
    "Matutino": {
      bloques: 8,
      inicio: "7:00"
    },
    "Vespertino": {
      bloques: 7,
      inicio: "13:20"
    }
  };

  const duracionbloque = 50 // minutos
  const dias = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"];
  const turno = bloquesPorTurno[grupo.turno];

  if (!turno) throw new Error("Turno no válido: " + grupo.turno); //validacion de turno

  const bloques = turno.bloques;
  const matriz = [];

  let [horaInicio, minInicio] = turno.inicio.split(":").map(Number);
  let tiempoActual = horaInicio * 60 + minInicio;

  for (let i = 0; i < bloques; i++) {
    const horaInicioBloque = tiempoActual;
    const horaFinBloque = tiempoActual + duracionbloque;

    const horaStr = minutosAString(horaInicioBloque) + " - " + minutosAString(horaFinBloque);

    const fila = {
      numero: i + 1,
      hora: horaStr
    };

    dias.forEach(dia => {
      fila[dia] = null;
    });

    matriz.push(fila);
    tiempoActual = horaFinBloque; // avanzar al siguiente bloque
  }

  return matriz;
}

// convierte de minutos a formato de hora 
function minutosAString(minutos) {
  const hrs = Math.floor(minutos / 60);
  const mins = minutos % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}


function validarAsignacion(profesor, materia, horario) {
    // horas máximas
    if (profesor.horas_asignadas + materia.horas_semanales > profesor.horas_maximas) {
        return false;
    }
    
    // si puede dar la materia
    if (!profesor.materias.includes(materia.id)) {
        return false;
    }
    
    return true;
}

function generarHorario(materias, horasPorDia = 8, dias = 5) {
  const horario = Array.from({ length: dias }, () => 
    Array(horasPorDia).fill(null)
  ); 

 //ordenar las materias de mayor a menor pq es m'as sencillo asignar las de mayor carga primero
  const materiasOrdenadas = [...materias].sort((a, b) =>  //sort comparator
    b.horas_semanales - a.horas_semanales
  );

  for (const materia of materiasOrdenadas) {
    let horasAsignadas = 0;
    
    //si la materia es de tronco común, tiene un máximo de 2 hrs por día
    
    //si la materia es de tipo extracurricular, asignar 1 hora por día y en las ultimas horas
    

    // Intentar asignar en bloques consecutivos primero
    for (let dia = 0; dia < dias && horasAsignadas < materia.horas_semanales; dia++) {
      for (let hora = 0; hora < horasPorDia && horasAsignadas < materia.horas_semanales; hora++) {
        if (horario[dia][hora] === null) {
          // Intentar bloque de 2 horas si es posible
          const horasDisponibles = Math.min(2, materia.horas_semanales - horasAsignadas);
          let bloqueValido = true;
          
          // Verificar si hay espacio para el bloque
          for (let h = 0; h < horasDisponibles; h++) {
            if (hora + h >= horasPorDia || horario[dia][hora + h] !== null) {
              bloqueValido = false;
              break;
            }
          }
          
          if (bloqueValido) {
            for (let h = 0; h < horasDisponibles; h++) {
              horario[dia][hora + h] = materia.nombre;
            }
            horasAsignadas += horasDisponibles;
            hora += horasDisponibles - 1; // Saltar horas asignadas
          } else if (horasDisponibles === 1) {
            // Asignar solo 1 hora si no cabe el bloque
            horario[dia][hora] = materia.nombre;
            horasAsignadas += 1;
          }
        }
      }
    }
    
    if (horasAsignadas < materia.horas_semanales) {
      console.warn(`No se asignaron todas las horas para ${materia.nombre} (${horasAsignadas}/${materia.horas_semanales} horas)`);
    }
  }

  return horario;
}

function mostrarHorarioHorizontal(horario) {
  const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  
  console.log("\nHORARIO ESCOLAR");
  console.log("===============\n");
  
  // Encabezado con días
  let header = "Hora   |";
  dias.forEach(dia => {
    header += ` ${dia.padEnd(20)}|`;
  });
  console.log(header);
  console.log("-".repeat(header.length));

  // Filas por hora
  for (let hora = 0; hora < horario[0].length; hora++) {
    let fila = `${(hora + 1 + "ª").padEnd(6)}|`;
    
    for (let dia = 0; dia < dias.length; dia++) {
      const texto = horario[dia][hora] || "Libre";
      fila += ` ${texto.padEnd(20)}|`;
    }
    
    console.log(fila);
    console.log("-".repeat(header.length));
  }
}

// Ejemplo de uso
const materias1ro = filtrarMateriasPorSemestre(materias, 1);
const horario1ro = generarHorario(materias1ro);
mostrarHorarioHorizontal(horario1ro);


