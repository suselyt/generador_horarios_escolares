const fs = require('fs'); //modulo para leer archivos
const { format } = require('path');

const materias = JSON.parse(fs.readFileSync("materias.json", "utf8"));
const grupos = JSON.parse(fs.readFileSync("grupos.json", "utf8"));
const profesores = JSON.parse(fs.readFileSync("profesores.json", "utf8"));
const config = JSON.parse(fs.readFileSync("general.json", "utf8"));

//clase generador horarios que tiene metodos para crearlo
class GeneradorHorarios {
    constructor(materias, grupos, profesores, config) {
        this.materias = materias;
        this.grupos = grupos;
        this.profesores = profesores;
        this.config = config;
        this.dias = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"];
        this.totalBloques = config.bloques_matutino + config.bloques_vespertino; //bloques del horario
    }

    crearMatrizHorario() {
        const matriz = {}; //crea objeto matriz
        for (let dia of this.dias) {   //poar cada dia en matriz 
            matriz[dia] = {};
            for (let bloque = 1; bloque <= this.totalBloques; bloque++) { //por cada bloque en total bloques
                matriz[dia][bloque] = {
                    materia: null,
                    grupo: null,
                    semestre: null
                };
            }
        }
        return matriz;
    }

    // cada profesor del arreglo profesores tiene la propiedad de horario
    inicializarHorariosProfesores() {
        for (const profesor of this.profesores) {
            profesor.horario = this.crearMatrizHorario();
        }
    }


    // FUNCIONES PARA IDENTIFICAR TURNOS Y HORAS DEL PROFESOR

    // Determinar si un bloque es matutino
    esMatutino(bloque) {
        return bloque <= this.config.bloque_fin_matutino;
    }

    // Determinar si un bloque es vespertino
    esVespertino(bloque) {
        return bloque >= this.config.bloque_inicio_vespertino;
    }

    // Validar que grupos solo tomen bloques de su turno
    validarTurnoGrupo(grupo, bloque) {
        if (!grupo.turno) {
            return true;
        }

        if (grupo.turno === "matutino" && !this.esMatutino(bloque)) {
            return false;
        }
        if (grupo.turno === "vespertino" && !this.esVespertino(bloque)) {
            return false;
        }
        return true;
    }

    //calculo de hroas de profesor frente al grupo. se le restan las horas totales del maestro las de fortalecimiento academico
    calcularHorasDisponiblesProfesor(profesor) {
        let horasFortalecimiento = 0;
        if (profesor.horas_fortalecimiento_academico) {
            horasFortalecimiento = profesor.horas_fortalecimiento_academico
                .reduce((total, item) => total + item.horas, 0);
        }
        return profesor.horas_semanales - horasFortalecimiento;
    }

    calcularCargaHorariaGrupo(grupo) {
        let totalHoras = 0;

        for (const materia of this.materias) {
            if (materia.semestre === grupo.semestre) {
                if (materia.tipo === "modulo_profesional") {
                    if (materia.especialidad === grupo.especialidad) {
                        totalHoras += materia.horas_semanales;
                    }
                } else {
                    totalHoras += materia.horas_semanales;
                }
            }
        }

        return totalHoras;
    }




    //las siguientes funciones CREAN HORARIO
    //FUNCIONES GENERALES QUE DEPENDEN DE OTRAS

    //crea el horario utilizando las funciones para asignar pero en orden
    generarHorarios() {
        this.inicializarHorariosProfesores();

        this.asignarExtracurriculares(); //1. asignar extracurriculares
        this.asignarModuloProfesional(); //2. asignar modulo profesional
        this.asignarTroncoComun();


    }

    asignarMateria(dia, bloque, profesor, grupo, materiaId) {
        const materia = this.materias.find(m => m.id === materiaId);
        profesor.horario[dia][bloque] = {
            materia: materia ? materia.nombre : materiaId,
            grupo: grupo.nomenclatura,
            semestre: grupo.semestre
        }
    }

    // aqui esta la verficación de restricciones para poder asignar las materias
    cumpleRestricciones(dia, bloque, profesor, grupo, materia) {

        //1. verifica que el profesor no este dando una materia en ese bloque
        if (profesor.horario[dia][bloque].materia != null) {
            return false;
        }

        //2. verifica que el grupo no esté teniendo una clase en ese bloque
        if (this.grupoTieneClases(grupo, dia, bloque)) {
            return false;
        }

        //3. validar turno del grupo
        if (!this.validarTurnoGrupo(grupo, bloque)) {
            return false;
        }

        //4. extracurriculares en bloques final
        if (materia && materia.tipo === "extracurricular") {
            if (bloque != this.config.bloque_fin_matutino) {
                return false;
            }
        }

        //5. bloques recomendados no asignar
        if (profesor.bloques_recomendados_no_asignar && profesor.bloques_recomendados_no_asignar.includes(bloque)) {
            return false;
        }

        //6. verificacion de materia con semestre de grupo
        if (materia) {
            const materiaInfo = this.materias.find(m => m.id === materia.id || m.id === materia);
            if (materiaInfo && materiaInfo.semestre && materiaInfo.semestre != grupo.semestre) {
                return false;
            }
        }

        //7. no repetir misma materia al dia 
        if (materia && this.grupoTuvoPorDia(grupo, materia, dia)) {
            return false;
        }

        //8.maximos de horas por materia
        if (materia) {
            const materiaObj = this.materias.find(m => m.id === (materia.id || materia));
            if (materiaObj) {
                const maxHorasPorDia = this.calcularMaxHorasPorDia(materiaObj);
                if (this.contarHorasMateriaPorDia(grupo, materia, dia) >= maxHorasPorDia) {
                    return false;
                }
            }
        }

        //9. un solo profesor por materia-grupo
        if (materia && this.otroProfesorTieneGrupoParaMateria(profesor, grupo, materia)) {
            return false;
        }

        return true; //todas las restrucciones se cumplen
    }



    //FUNCIONES PARA LAS RESTRICCIONES
    //verificar si el grupo ya tiene una clase en el bloque
    grupoTieneClases(grupo, dia, bloque) {
        for (const profesor of this.profesores) {
            if (profesor.horario[dia][bloque].grupo === grupo.nomenclatura) { //desde el horario del profe ver si el grupo ya tiene un bloque asignado
                return true;
            }
        }
        return false;
    }

    //verifica cuantas horas tiene un grupo de una materia especifica en un dia 
    contarHorasMateriaPorDia(grupo, materia, dia) {
        let contador = 0;
        for (const profesor of this.profesores) {
            for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                if (profesor.horario[dia][bloque].grupo === grupo.nomenclatura &&
                    profesor.horario[dia][bloque].materia === materia) {
                    contador++;
                }
            }
        }
        return contador;
    }

    //verificar si el grupo ya tuvo la materia en el dia
    grupoTuvoPorDia(grupo, materia, dia) {
        return this.contarHorasMateriaPorDia(grupo, materia, dia) > 0;
    }

    calcularMaxHorasPorDia(materia) {
        // horas maxima para modulo profesional 5
        if (materia.tipo === "modulo_profesional") {
            return 5;
        }
        //horas maxima para extracurricular
        else if (materia.tipo === "extracurricular") {
            return 1;
        }

        // Para otras materias, máximo 2 horas por día
        if (materia.horas_semanales <= 2) {
            return 1;
        }
        return 2;
    }

    profesorTieneGrupoParaMateria(profesor, grupo, materia) {
        for (const dia of this.dias) {
            for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                if (profesor.horario[dia][bloque].materia === materia &&
                    profesor.horario[dia][bloque].grupo === grupo.nomenclatura) {
                    return true;
                }
            }
        }
        return false;
    }

    otroProfesorTieneGrupoParaMateria(profesorActual, grupo, materia) {
        for (const profesor of this.profesores) {
            if (profesor !== profesorActual) {
                if (this.profesorTieneGrupoParaMateria(profesor, grupo, materia)) {
                    return true;
                }
            }
        }
        return false;
    }



    //FUNCIONES PARA ASIGNAR MATERIAS

    asignarExtracurriculares() {
        for (const profesor of this.profesores) {
            for (const materiaId of profesor.materias) {
                //obtiene datos completos de la materia
                const materia = this.materias.find(m => m.id === materiaId);
                if (!materia || materia.tipo != "extracurricular") continue;

                for (const grupo of this.grupos) {

                    //solo asignar si el grupo corresponde al semestre de la mateira
                    if (materia.semestre && grupo.semestre != materia.semestre) continue;

                    //solo usar el bloque final
                    let bloqueFinal = this.config.bloque_fin_matutino;

                    for (let dia of this.dias) {
                        for (let bloque of bloqueFinal) {
                            if (this.cumpleRestricciones(dia, bloqueFinal, profesor, grupo, materia)) {
                                this.asignarMateria(dia, bloqueFinal, profesor, grupo, materiaId);
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    asignarModuloProfesional() {
        for (const profesor of this.profesores) {
            for (const materiaId of profesor.materias) {
                const materia = this.materias.find(m => m.id === materiaId);
                if (!materia || materia.tipo != "modulo_profesional") continue;

                for (const grupo of this.grupos) {
                    // Validaciones de semestre y especialidad
                    if (materia.semestre && grupo.semestre != materia.semestre) continue;
                    if (materia.especialidad && grupo.especialidad != materia.especialidad) continue;

                    // Obtener los bloques recomendados (ej: [4, 4, 4, 5])
                    const bloquesRecomendados = materia.bloques_recomendados || [];
                    let bloqueAsignado = false;

                    // Intentar asignar cada bloque de horas recomendado
                    for (const cantidadHoras of bloquesRecomendados) {
                        let asignadoEsteBloque = false;

                        // Buscar en todos los días un espacio para este bloque
                        for (const dia of this.dias) {
                            if (this.asignarBloquesConsecutivos(dia, profesor, grupo, materia, cantidadHoras)) {
                                asignadoEsteBloque = true;
                                bloqueAsignado = true;
                                break; // Pasar al siguiente bloque de horas
                            }
                        }

                        // Si no se pudo asignar este bloque, no continuar con los siguientes
                        if (!asignadoEsteBloque) {
                            console.log(`No se pudo asignar bloque de ${cantidadHoras} horas para ${materia.nombre}`);
                            break;
                        }
                    }

                    // Si se asignó al menos un bloque, pasar al siguiente grupo
                    if (bloqueAsignado) {
                        console.log(`Asignado módulo profesional: ${materia.nombre} al grupo ${grupo.nomenclatura}`);
                        // Opcionalmente, puedes hacer break aquí si solo quieres asignar a un grupo
                    }
                }
            }
        }
    }

    asignarTroncoComun() {
        for (const profesor of this.profesores) { //itera en todos los profesore
            for (const materiaId of profesor.materias) { //itera por el id de materias de los profesores
                const materia = this.materias.find(m => m.id === materiaId) //busca la info completa de la materia
                if (!materia || materia.tipo != "tronco_comun") continue; //si la materia no es tronco comun, sigue a la sig

                //verificacion de semestre
                for (const grupo of this.grupos) {
                    if (materia.semestre && grupo.semestre != materia.semestre) continue;

                    for (let dia of this.dias) {
                        for (let bloque = 1; bloque <= this.totalBloques; bloque ++) {
                            if (this.cumpleRestricciones(dia, bloque, profesor, grupo, materia)) {
                                this.asignarMateria(dia, bloque, profesor, grupo, materiaId);
                                break;
                            }
                        }
                    }
                }
            }
        }
    }


    // FUNCIONES AUXILIARES PARA ASIGNAR BLOQUES

    //buscar bloques consecutivos con espacios
    encontrarBloquesConsecutivos(dia, profesor, grupo, cantidadHoras) {
        const totalBloques = this.totalBloques;

        // Buscar secuencias consecutivas de la cantidad de horas requerida
        for (let bloqueInicio = 1; bloqueInicio <= totalBloques - cantidadHoras + 1; bloqueInicio++) {
            let disponible = true;

            // verificar si todos los bloques consecutivos están disponibles
            for (let i = 0; i < cantidadHoras; i++) {
                const bloqueActual = bloqueInicio + i;

                // verificar si este bloque cumple restricciones
                if (!this.cumpleRestricciones(dia, bloqueActual, profesor, grupo, null)) {
                    disponible = false;
                    break;
                }
            }

            if (disponible) {
                // retornar el rango de bloques consecutivos
                return {
                    inicio: bloqueInicio,
                    fin: bloqueInicio + cantidadHoras - 1,
                    bloques: Array.from({ length: cantidadHoras }, (_, i) => bloqueInicio + i)
                };
            }
        }

        return null; // no hay bloques consecutivos disponibles
    }

    asignarBloquesConsecutivos(dia, profesor, grupo, materia, cantidadHoras) {
        const bloquesDisponibles = this.encontrarBloquesConsecutivos(dia, profesor, grupo, cantidadHoras);

        if (bloquesDisponibles) {
            // Asignar todos los bloques consecutivos
            for (const bloque of bloquesDisponibles.bloques) {
                this.asignarMateria(dia, bloque, profesor, grupo, materia);
            }
            return true;
        }

        return false;
    }



    // METODOS PARA VALIDACION Y DEBUG
    // Validar factibilidad del horario
    validarFactibilidad() {
        const errores = [];

        // Verificar que hay suficientes profesores para cubrir la carga
        for (const grupo of this.grupos) {
            const cargaGrupo = this.calcularCargaHorariaGrupo(grupo);
            let horasDisponibles = 0;

            for (const profesor of this.profesores) {
                horasDisponibles += this.calcularHorasDisponiblesProfesor(profesor);
            }

            if (cargaGrupo > horasDisponibles) {
                errores.push(`Grupo ${grupo.nomenclatura}: Carga ${cargaGrupo} > Horas disponibles ${horasDisponibles}`);
            }
        }

        return errores;
    }

    // Calcular huecos en horario de profesor
    calcularHuecosProfesor(profesor) {
        let huecos = 0;

        for (const dia of this.dias) {
            let primerBloque = null;
            let ultimoBloque = null;

            // Encontrar primer y último bloque ocupado
            for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                if (profesor.horario[dia][bloque].materia) {
                    if (primerBloque === null) primerBloque = bloque;
                    ultimoBloque = bloque;
                }
            }

            // Contar huecos entre primer y último bloque
            if (primerBloque !== null && ultimoBloque !== null) {
                for (let bloque = primerBloque; bloque <= ultimoBloque; bloque++) {
                    if (!profesor.horario[dia][bloque].materia) {
                        huecos++;
                    }
                }
            }
        }

        return huecos;
    }

    // Mostrar estadísticas del horario
    mostrarEstadisticas() {
        console.log("=== ESTADÍSTICAS DEL HORARIO ===");

        for (const profesor of this.profesores) {
            const horasDisponibles = this.calcularHorasDisponiblesProfesor(profesor);
            const huecos = this.calcularHuecosProfesor(profesor);

            console.log(`\nProfesor: ${profesor.nombre}`);
            console.log(`  Horas totales: ${profesor.horas_semanales}`);
            console.log(`  Horas disponibles: ${horasDisponibles}`);
            console.log(`  Huecos en horario: ${huecos}`);
        }

        console.log("\n=== CARGA POR GRUPO ===");
        for (const grupo of this.grupos) {
            const carga = this.calcularCargaHorariaGrupo(grupo);
            console.log(`Grupo ${grupo.nomenclatura}: ${carga} horas`);
        }
    }
}

//PRUEBAS
const prueba = new GeneradorHorarios(materias, grupos, profesores, config);
prueba.inicializarHorariosProfesores();

// Mostrar estadísticas antes de generar horarios
console.log("=== ANTES DE GENERAR HORARIOS ===");
prueba.mostrarEstadisticas();

// Validar factibilidad
const errores = prueba.validarFactibilidad();
if (errores.length > 0) {
    console.log("\n=== ERRORES DE FACTIBILIDAD ===");
    errores.forEach(error => console.log(error));
}

// Generar horarios
prueba.generarHorarios();

// Mostrar estadísticas después
console.log("\n=== DESPUÉS DE GENERAR HORARIOS ===");
prueba.mostrarEstadisticas();

console.log("\n=== HORARIO DEL PRIMER PROFESOR ===");
console.log(prueba.profesores[0].horario);