const fs = require('fs');

// Cargar datos
const materias = JSON.parse(fs.readFileSync("materias.json", "utf8"));
const grupos = JSON.parse(fs.readFileSync("grupos.json", "utf8"));
const profesores = JSON.parse(fs.readFileSync("profesores.json", "utf8"));

function filtrarMateriasPorGrado(materias, grado) {
  return materias.filter(materia => 
    materia.grado === undefined || // Incluye las que no tienen grado definido
    materia.grado === grado
  );
}

// Función mejorada para generar horarios
function generarHorarioCompleto(grupoId) {
  const grupo = grupos.find(g => g.nomenclatura === grupoId);
  if (!grupo) throw new Error("Grupo no encontrado");

  const materiasGrupo = filtrarMateriasPorGrado(materias, grupo.semestre);
  const horarioBase = generarHorarioGrupo(materiasGrupo);
  
  return {
    grupo: grupoId,
    semestre: grupo.semestre,
    turno: grupo.turno,
    horario: horarioBase,
    // Espacio para asignación posterior de profesores
    profesoresAsignados: {}
  };
}

function generarHorarioGrupo(materias, horasPorDia = 8, dias = 5) {
  const horario = Array.from({ length: dias }, () => 
    Array(horasPorDia).fill(null)
  );

  const materiasOrdenadas = [...materias].sort((a, b) => 
    b.horas_semanales - a.horas_semanales
  );

  for (const materia of materiasOrdenadas) {
    let horasAsignadas = 0;
    
    // Nueva lógica para bloques máx. de 3 horas
    while (horasAsignadas < materia.horas_semanales) {
      const horasRestantes = materia.horas_semanales - horasAsignadas;
      const tamanoBloque = Math.min(3, horasRestantes);
      
      const asignado = intentarAsignarBloque(horario, materia, tamanoBloque);
      if (asignado) {
        horasAsignadas += asignado;
      } else if (tamanoBloque > 1) {
        // Intentar con bloque más pequeño
        const asignado = intentarAsignarBloque(horario, materia, tamanoBloque - 1);
        if (asignado) horasAsignadas += asignado;
      } else {
        console.warn(`No se pudo asignar hora para ${materia.nombre}`);
        break;
      }
    }
  }

  return horario;
}

function intentarAsignarBloque(horario, materia, tamanoBloque) {
  for (let dia = 0; dia < horario.length; dia++) {
    for (let hora = 0; hora < horario[0].length - tamanoBloque + 1; hora++) {
      if (esBloqueValido(horario, dia, hora, tamanoBloque)) {
        for (let h = 0; h < tamanoBloque; h++) {
          horario[dia][hora + h] = {
            materia: materia.nombre,
            profesor: null // Para asignar después
          };
        }
        return tamanoBloque;
      }
    }
  }
  return 0;
}

function esBloqueValido(horario, dia, horaInicio, tamanoBloque) {
  // Verificar que todas las horas estén libres
  for (let h = 0; h < tamanoBloque; h++) {
    if (horario[dia][horaInicio + h] !== null) {
      return false;
    }
  }
  
  // Verificar que no haya más de 3 horas seguidas de la misma materia
  const horasPrevias = contarHorasContiguas(horario, dia, horaInicio - 1, materia.nombre);
  const horasPosteriores = contarHorasContiguas(horario, dia, horaInicio + tamanoBloque, materia.nombre);
  
  return (horasPrevias + tamanoBloque + horasPosteriores) <= 3;
}

function contarHorasContiguas(horario, dia, hora, nombreMateria) {
  let count = 0;
  while (hora >= 0 && hora < horario[0].length && 
         horario[dia][hora]?.materia === nombreMateria) {
    count++;
    hora++;
  }
  return count;
}

// Función para asignar profesores (interactiva o automática)
function asignarProfesores(horarioGenerado) {
  // Implementación posterior
  console.log("Lógica para asignar profesores");
}

// Ejemplo de uso mejorado
const horario101A = generarHorarioCompleto("101A");
mostrarHorarioHorizontal(horario101A.horario);