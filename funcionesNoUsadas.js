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
