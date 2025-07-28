const fs = require('fs'); //modulo para leer archivos

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
        this.bloques_recomendados_mod_profesional = [4, 4, 4, 5];

    }

    /////////////////////////////////////// CREACION DE MATRICES ////////////////////////////////////////////

    crearMatrizHorarioProfesores() {
        const matriz = {}; //crea objeto matriz
        for (let dia of this.dias) {   //para cada dia en matriz 
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

    crearMatrizHorarioEscolar(grupo) {
        const matriz = {};
        let bloque_inicio, bloque_fin;
        let total_bloques = bloque_fin - bloque_inicio + 1;

        // si es grupo matutino ocupa los bloques obtenidos desde general
        if (grupo.turno === "Matutino") {
            bloque_inicio = 1;
            bloque_fin = this.config.bloque_fin_matutino;
        }
        // si es grupo vespertino ocupa los bloques obtenidos 
        else if (grupo.turno === "Vespertino") {
            bloque_inicio = this.config.bloque_inicio_vespertino;
            bloque_fin = this.totalBloques;
        } else {
            throw new Error("turno no reconocido");
        }

        for (let dia of this.dias) {
            matriz[dia] = {}
            for (let bloque = bloque_inicio; bloque <= bloque_fin; bloque++) {
                matriz[dia][bloque] = {
                    materia: null,
                    docente: null,
                    aula: null
                };
            }
        }
        return { matriz, total_bloques };
    }

    // cada profesor del arreglo profesores tiene la propiedad de horario
    inicializarHorariosProfesores() {
        for (const profesor of this.profesores) {
            profesor.horario = this.crearMatrizHorarioProfesores();
        }
    }

    // cada grupo tiene la propiedad de horario
    inicializarHorariosEscolares() {
        for (const grupo of this.grupos) {
            const resultado = this.crearMatrizHorarioEscolar(grupo);
            grupo.horario = resultado.matriz;
            grupo.total_bloques = resultado.total_bloques;
        }
    }


    ///////////////////////////// FUNCIONES PARA IDENTIFICAR TURNOS Y HORAS DEL PROFESOR ///////////////////////////////////////

    // determinar si un bloque es matutino
    esMatutino(bloque) {
        return bloque <= this.config.bloque_fin_matutino;
    }

    // determinar si un bloque es vespertino
    esVespertino(bloque) {
        return bloque >= this.config.bloque_inicio_vespertino;
    }

    //validacion de turnos esta en funciones para restricciones (aprox linea 213)

    //calculo de horas de profesor frente al grupo. se le restan las horas totales del maestro las de fortalecimiento academico
    calcularHorasDisponiblesProfesor(profesor) {
        let horasFortalecimiento = 0;
        if (profesor.horas_fortalecimiento_academico) {
            horasFortalecimiento = profesor.horas_fortalecimiento_academico
                .reduce((total, item) => total + item.horas, 0);
        }
        return profesor.horas_semanales - horasFortalecimiento;
    }

    // calcular las horas semanales que tiene un grupo y ver si al final le faltan por asignar
    calcularCargaHorariaGrupo(grupo) {
        let totalHoras = 0;

        for (const materia of this.materias) {
            if (materia.semestre === grupo.semestre) {
                if (materia.tipo === "modulo_profesional") {
                    if (materia.carrera === grupo.carrera) {
                        totalHoras += materia.horas_semanales;
                    }
                } else {
                    totalHoras += materia.horas_semanales;
                }
            }
        }

        return totalHoras;
    }



    ////////////////////////////////////////// GENERAR HORARIO ///////////////////////////////////////////
    //                          son funciones finales que dependen de otras 

    //genera el horario de los maestros utilizando las funciones para asignar pero en orden
    generarHorariosDocentes() {
        this.inicializarHorariosProfesores();

        this.asignarExtracurriculares(); //1. asignar extracurriculares
        this.asignarModuloProfesional(); //2. asignar modulo profesional
        this.asignarTroncoComun(); // 3. tronco comun
        this.asignarFortalecimientoAcademico();// 4. fortalecimiento academico
    }

    //pasa la info de los horarios de los docentes a generales basandose en su index
    generarHorariosGrupales() {
        this.inicializarHorariosEscolares();

        console.log("Iniciando generación de horarios grupales...");


        //recorrer todos los profesores para la info
        for (const profesor of this.profesores) {
            for (const dia of this.dias) {
                for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                    const bloqueProfesor = profesor.horario[dia][bloque];

                    //si el profesor tiene una clase asignada
                    if (bloqueProfesor.materia && bloqueProfesor.grupo) {
                        const grupo = this.grupos.find(g => g.nomenclatura === bloqueProfesor.grupo);

                        if (grupo) {

                            if (!grupo.horario || !grupo.horario[dia]) {
                                console.log(`Advertencia: Grupo ${grupo.nomenclatura} no tiene horario inicializado para ${dia}`);
                                continue;
                            }

                            if (!grupo.horario[dia][bloque]) {
                                console.log(`Bloque ${bloque} no existe en horario del grupo ${grupo.nomenclatura} (${grupo.turno})`);
                                continue;
                            }

                            //verificar si el bloque esta en el rango del turno
                            if (this.validarTurnoGrupo(grupo, bloque)) {
                                grupo.horario[dia][bloque] = {
                                    materia: bloqueProfesor.materia,
                                    docente: profesor.nombre,
                                    aula: null
                                };
                                console.log(`Asignado: ${bloqueProfesor.materia} - ${profesor.nombre} - Grupo ${grupo.nomenclatura} - ${dia} Bloque ${bloque}`);
                            } else {
                                console.log(`Bloque ${bloque} no válido para turno ${grupo.turno} del grupo ${grupo.nomenclatura}`);
                            }
                        } else {
                            console.log(`Grupo ${bloqueProfesor.grupo} no encontrado`);
                        }
                    }
                }
            }

        }
        console.log("Generación de horarios grupales completada.");
    }

    generarHorariosPorSemestre() {
        this.generarHorariosGrupales();

        // Organizar horarios por semestre
        const horariosPorSemestre = {};

        for (const grupo of this.grupos) {
            const semestre = grupo.semestre;

            if (!horariosPorSemestre[semestre]) {
                horariosPorSemestre[semestre] = {};
            }

            horariosPorSemestre[semestre][grupo.nomenclatura] = {
                grupo: grupo.nomenclatura,
                turno: grupo.turno,
                carrera: grupo.carrera,
                horario: grupo.horario
            };
        }
        return horariosPorSemestre;
    }


    ////////////////////////////////////FUNCIONES PARA LAS RESTRICCIONES /////////////////////////////////////////////////
    //                              verifican cumplimiento de reglas de negocio
    // funcion general que verifica el cumplimiento de todas las restricciones
    // esta funcion se usa en asignarMateria()
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

        // 10. valida las horas máximas de los maestros
        if (!this.profesorPuedeTomarMasHoras(profesor)) {
            return false;
        }

        return true; //todas las restrucciones se cumplen
    }

    //verificar si el grupo ya tiene una clase en el bloque
    grupoTieneClases(grupo, dia, bloque) {
        for (const profesor of this.profesores) {
            if (profesor.horario[dia][bloque].grupo === grupo.nomenclatura) { //desde el horario del profe ver si el grupo ya tiene un bloque asignado
                return true;
            }
        }
        return false;
    }

    //cuenta las que horas tiene un grupo de una materia especifica en un dia, para evitar exceder los m'aximos
    contarHorasMateriaPorDia(grupo, materia, dia) {
        let contador = 0;
        const materiaId = materia.id || materia;
        const materiaInfo = this.materias.find(m => m.id === materiaId);
        const materiaNombre = materiaInfo ? materiaInfo.nombre : materiaId;

        for (const profesor of this.profesores) {
            for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                if (profesor.horario[dia][bloque].grupo === grupo.nomenclatura &&
                    profesor.horario[dia][bloque].materia === materiaNombre) {
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

        if (materia.horas_semanales <= 2) {
            return 1;
        }
        return 2;
    }

    // verifica que el maestro de el mismo grupo que ya estaba dando con esa materia?
    profesorTieneGrupoParaMateria(profesor, grupo, materia) {
        const materiaId = materia.id || materia;
        const materiaInfo = this.materias.find(m => m.id === materiaId);
        const materiaNombre = materiaInfo ? materiaInfo.nombre : materiaId;

        for (const dia of this.dias) {
            for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                if (profesor.horario[dia][bloque].materia === materiaNombre &&
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

    // sumando las horas que tiene el profesor
    calcularHorasAsignadasProfesor(profesor) {
        let horasAsignadas = 0;

        for (const dia of this.dias) {
            for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                if (profesor.horario[dia][bloque].materia !== null) {
                    horasAsignadas++;
                }
            }
        }

        return horasAsignadas;
    }

    // verifica si el maestro ya excedi'o su limite de horas
    profesorPuedeTomarMasHoras(profesor) {
        const horasDisponibles = this.calcularHorasDisponiblesProfesor(profesor);
        const horasAsignadas = this.calcularHorasAsignadasProfesor(profesor);

        return horasAsignadas < horasDisponibles;
    }

    // validar que grupos solo tomen bloques de su turno
    validarTurnoGrupo(grupo, bloque) {
        // si el grupo no tiene turno se asigna donde sea para evitar romper el programa
        if (!grupo.turno) {
            return true;
        }

        if (grupo.turno === "Matutino" && !this.esMatutino(bloque)) {
            return false;
        }
        if (grupo.turno === "Vespertino" && !this.esVespertino(bloque)) {
            return false;
        }
        return true; //regresa que se cumplió la validación
    }


    ////////////////////////////////////// FUNCIONES PARA ASIGNAR MATERIAS/////////////////////////////////////////

    //funcion general para asignar la materia a un profesor
    asignarMateria(dia, bloque, profesor, grupo, materiaId) {
        const materia = this.materias.find(m => m.id === materiaId);
        profesor.horario[dia][bloque] = {
            materia: materia ? materia.nombre : materiaId,
            grupo: grupo.nomenclatura,
            semestre: grupo.semestre
        }
    }

    asignarExtracurriculares() {
        // Agrupar materias extracurriculares por semestre
        const extracurricularesPorSemestre = {};

        for (const materia of this.materias) {
            if (materia.tipo === "extracurricular") {
                if (!extracurricularesPorSemestre[materia.semestre]) {
                    extracurricularesPorSemestre[materia.semestre] = [];
                }
                extracurricularesPorSemestre[materia.semestre].push(materia);
            }
        }

        // Procesar cada semestre
        for (const [semestre, materiasExtracurriculares] of Object.entries(extracurricularesPorSemestre)) {
            // Obtener todos los grupos matutinos de este semestre
            const gruposMatutinos = this.grupos.filter(g =>
                g.semestre == semestre && g.turno === "Matutino"
            );

            if (gruposMatutinos.length === 0) {
                console.log(`No hay grupos matutinos para semestre ${semestre}`);
                continue;
            }

            // Para cada materia extracurricular del semestre
            for (const materia of materiasExtracurriculares) {
                // Buscar profesor que puede dar esta materia
                const profesorDisponible = this.profesores.find(profesor =>
                    profesor.materias.includes(materia.id) &&
                    this.profesorPuedeTomarMasHoras(profesor)
                );

                if (!profesorDisponible) {
                    console.log(`No se encontró profesor disponible para ${materia.nombre}`);
                    continue;
                }

                // Asignar las horas semanales necesarias
                let horasAsignadas = 0;
                const horasNecesarias = materia.horas_semanales;

                // Buscar días disponibles para todos los grupos
                for (const dia of this.dias) {
                    if (horasAsignadas >= horasNecesarias) break;

                    const bloqueFinal = this.config.bloque_fin_matutino;

                    // Verificar si el profesor está disponible en este bloque
                    if (profesorDisponible.horario[dia][bloqueFinal].materia !== null) {
                        continue; // Profesor ocupado
                    }

                    // Verificar si todos los grupos pueden tomar clase en este bloque
                    let todosDisponibles = true;
                    for (const grupo of gruposMatutinos) {
                        if (this.grupoTieneClases(grupo, dia, bloqueFinal)) {
                            todosDisponibles = false;
                            break;
                        }
                    }

                    if (todosDisponibles) {
                        // Asignar a todos los grupos del semestre
                        for (const grupo of gruposMatutinos) {
                            profesorDisponible.horario[dia][bloqueFinal] = {
                                materia: materia.nombre,
                                grupo: grupo.nomenclatura,
                                semestre: grupo.semestre
                            };

                            console.log(`Asignado extracurricular: ${materia.nombre} - ${grupo.nomenclatura} - ${dia} Bloque ${bloqueFinal}`);
                        }
                        horasAsignadas++;
                    }
                }

                if (horasAsignadas < horasNecesarias) {
                    console.log(`Advertencia: Solo se asignaron ${horasAsignadas} de ${horasNecesarias} horas para ${materia.nombre}`);
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
                    // validación de semestre y carrera
                    if (materia.semestre && grupo.semestre != materia.semestre) continue;
                    if (materia.carrera && grupo.carrera != materia.carrera) continue;

                    // verificar si esta materia ya fue asignada a este grupo por otro profesor
                    if (this.otroProfesorTieneGrupoParaMateria(profesor, grupo, materia)) {
                        continue;
                    }

                    let bloqueAsignado = false;

                    // Intentar asignar cada bloque de horas recomendado
                    for (const cantidadHoras of this.bloques_recomendados_mod_profesional) {
                        let asignadoEsteBloque = false;

                        // Buscar en todos los días un espacio para este bloque
                        for (const dia of this.dias) {
                            // Verificar que no exceda el máximo de horas por día 
                            const horasActualesEnDia = this.contarHorasMateriaPorDia(grupo, materia, dia);
                            const maxHorasPorDia = this.calcularMaxHorasPorDia(materia);

                            if (horasActualesEnDia + cantidadHoras > maxHorasPorDia) {
                                continue; // Este día ya no puede recibir más horas de esta materia
                            }

                            if (this.asignarBloquesConsecutivos(dia, profesor, grupo, materia, cantidadHoras)) {
                                asignadoEsteBloque = true;
                                bloqueAsignado = true;
                                break; // Pasar al siguiente bloque de horas
                            }
                        }

                        // Si no se pudo asignar este bloque, no continuar con los siguientes
                        if (!asignadoEsteBloque) {
                            console.log(`No se pudo asignar bloque de ${cantidadHoras} horas para ${materia.nombre} al grupo ${grupo.nomenclatura}`);
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
        for (const profesor of this.profesores) {
            for (const materiaId of profesor.materias) {
                const materia = this.materias.find(m => m.id === materiaId);
                if (!materia || materia.tipo != "tronco_comun") continue;

                for (const grupo of this.grupos) {
                    if (materia.semestre && grupo.semestre != materia.semestre) continue;

                    // Verificar si esta materia ya fue asignada a este grupo por otro profesor
                    if (this.otroProfesorTieneGrupoParaMateria(profesor, grupo, materia)) {
                        continue;
                    }

                    // Calcular cuántas horas necesitamos asignar
                    const horasAsignadas = this.contarHorasAsignadasGrupoMateria(grupo, materia);
                    const horasRestantes = materia.horas_semanales - horasAsignadas;

                    if (horasRestantes <= 0) continue;

                    // Priorizar asignación por bloques de 2 horas
                    let asignacionExitosa = false;

                    // Intentar asignar en bloques de 2 horas primero
                    while (horasRestantes >= 2) {
                        let asignadoBloque2 = false;

                        for (const dia of this.dias) {
                            if (this.asignarBloquesConsecutivosTroncoComun(dia, profesor, grupo, materia, 2)) {
                                asignadoBloque2 = true;
                                asignacionExitosa = true;
                                break;
                            }
                        }

                        if (!asignadoBloque2) break;
                    }

                    // Si quedan horas sueltas, asignar de a 1
                    const horasRestantesFinal = materia.horas_semanales - this.contarHorasAsignadasGrupoMateria(grupo, materia);

                    for (let i = 0; i < horasRestantesFinal; i++) {
                        let asignadoHora = false;

                        for (const dia of this.dias) {
                            // Verificar que no se repita la materia en el mismo día
                            if (this.grupoTuvoPorDia(grupo, materia, dia)) continue;

                            for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                                if (this.cumpleRestricciones(dia, bloque, profesor, grupo, materia)) {
                                    this.asignarMateria(dia, bloque, profesor, grupo, materiaId);
                                    asignadoHora = true;
                                    asignacionExitosa = true;
                                    break;
                                }
                            }
                            if (asignadoHora) break;
                        }
                        if (!asignadoHora) break;
                    }

                    if (asignacionExitosa) {
                        console.log(`Asignado tronco común: ${materia.nombre} al grupo ${grupo.nomenclatura}`);
                    }
                }
            }
        }
    }

    asignarFortalecimientoAcademico() {
        for (const profesor of this.profesores) {
            const actividades = profesor.horas_fortalecimiento_academico;

            //si no tiene actividades no hace nada
            if (!actividades || actividades.length == 0) continue;

            for (const actividad of actividades) {
                let horasPorAsignar = actividad.horas;

                for (const dia of this.dias) {
                    if (horasPorAsignar <= 0) break;

                    // itera por todos los bloques
                    for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                        if (horasPorAsignar <= 0) break;

                        //  verificar si el bloque está disponible (vacío)

                        if (profesor.horario[dia][bloque].materia === null) {

                            if (profesor.bloques_recomendados_no_asignar && profesor.bloques_recomendados_no_asignar.includes(bloque)) {
                                profesor.horario[dia][bloque] = {
                                    materia: actividad.nombre,
                                    grupo: null,
                                    semestre: null
                                };
                            }

                            horasPorAsignar--;
                            console.log(`Asignado fortalecimiento académico: ${actividad.nombre} - ${profesor.nombre} - ${dia} Bloque ${bloque}`);
                        }
                    }
                }
            }
        }
    }


    // función auxiliar para contar horas ya asignadas de una materia a un grupo
    contarHorasAsignadasGrupoMateria(grupo, materia) {
        let contador = 0;
        const materiaId = materia.id || materia;
        const materiaInfo = this.materias.find(m => m.id === materiaId);
        const materiaNombre = materiaInfo ? materiaInfo.nombre : materiaId;

        for (const profesor of this.profesores) {
            for (const dia of this.dias) {
                for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                    if (profesor.horario[dia][bloque].grupo === grupo.nomenclatura &&
                        profesor.horario[dia][bloque].materia === materiaNombre) {
                        contador++;
                    }
                }
            }
        }
        return contador;
    }


    ///////////////////////////////////// FUNCIONES AUXILIARES PARA ASIGNAR BLOQUES //////////////////////////////

    //buscar bloques consecutivos con espacios 
    encontrarBloquesConsecutivos(dia, profesor, grupo, cantidadHoras) {
        const totalBloques = this.totalBloques;

        // Buscar secuencias consecutivas de la cantidad de horas requerida
        for (let bloqueInicio = 1; bloqueInicio <= totalBloques - cantidadHoras + 1; bloqueInicio++) {
            let disponible = true;

            // verificar si todos los bloques consecutivos están disponibles
            for (let i = 0; i < cantidadHoras; i++) {
                const bloqueActual = bloqueInicio + i;

                // verificar si este bloque cumple restricciones básicas
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

    // Función específica para encontrar bloques consecutivos de tronco común
    encontrarBloquesConsecutivosTroncoComun(dia, profesor, grupo, materia, cantidadHoras) {
        const totalBloques = this.totalBloques;

        // Buscar secuencias consecutivas de la cantidad de horas requerida
        for (let bloqueInicio = 1; bloqueInicio <= totalBloques - cantidadHoras + 1; bloqueInicio++) {
            let disponible = true;

            // verificar si todos los bloques consecutivos están disponibles
            for (let i = 0; i < cantidadHoras; i++) {
                const bloqueActual = bloqueInicio + i;

                // verificar si este bloque cumple restricciones
                if (!this.cumpleRestricciones(dia, bloqueActual, profesor, grupo, materia)) {
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
                this.asignarMateria(dia, bloque, profesor, grupo, materia.id);
            }
            return true;
        }

        return false;
    }

    // Función específica para asignar bloques consecutivos de tronco común
    asignarBloquesConsecutivosTroncoComun(dia, profesor, grupo, materia, cantidadHoras) {
        // Verificar que no se repita la materia en el mismo día
        if (this.grupoTuvoPorDia(grupo, materia, dia)) {
            return false;
        }

        // Verificar que no exceda el máximo de horas por día
        const horasActualesEnDia = this.contarHorasMateriaPorDia(grupo, materia, dia);
        const maxHorasPorDia = this.calcularMaxHorasPorDia(materia);

        if (horasActualesEnDia + cantidadHoras > maxHorasPorDia) {
            return false;
        }

        const bloquesDisponibles = this.encontrarBloquesConsecutivosTroncoComun(dia, profesor, grupo, materia, cantidadHoras);

        if (bloquesDisponibles) {
            // Asignar todos los bloques consecutivos
            for (const bloque of bloquesDisponibles.bloques) {
                this.asignarMateria(dia, bloque, profesor, grupo, materia.id);
            }
            return true;
        }

        return false;
    }


    ////////////////////////////////////////////// METODOS PARA VALIDACION Y DEBUG ////////////////////////////////////////////
    //                                             validar factibilidad del horario
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
            const horasAsignadas = this.calcularHorasAsignadasProfesor(profesor);
            const huecos = this.calcularHuecosProfesor(profesor);
            const porcentajeUso = ((horasAsignadas / horasDisponibles) * 100).toFixed(1);

            console.log(`\nProfesor: ${profesor.nombre}`);
            console.log(`  Horas totales: ${profesor.horas_semanales}`);
            console.log(`  Horas disponibles: ${horasDisponibles}`);
            console.log(`  Horas asignadas: ${horasAsignadas}`);
            console.log(`  Horas restantes: ${horasDisponibles - horasAsignadas}`);
            console.log(`  Porcentaje de uso: ${porcentajeUso}%`);
            console.log(`  Huecos en horario: ${huecos}`);

            console.log(`  Materias: ${profesor.materias.join(', ')}`);

            // Alerta si se excede
            if (horasAsignadas > horasDisponibles) {
                console.log(` ALERTA: Profesor excede sus horas disponibles por ${horasAsignadas - horasDisponibles} horas`);
            }

        }

        console.log("\n=== CARGA POR GRUPO ===");
        for (const grupo of this.grupos) {
            const carga = this.calcularCargaHorariaGrupo(grupo);
            console.log(`Grupo ${grupo.nomenclatura}: ${carga} horas`);
        }
    }

    validarConsistenciaHorarios() {
        const errores = [];

        for (const profesor of this.profesores) {
            for (const dia of this.dias) {
                for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                    const bloqueProfesor = profesor.horario[dia][bloque];

                    if (bloqueProfesor.materia && bloqueProfesor.grupo) {
                        const grupo = this.grupos.find(g => g.nomenclatura === bloqueProfesor.grupo);

                        if (grupo) {
                            const bloqueGrupo = grupo.horario[dia][bloque];

                            if (!bloqueGrupo || !bloqueGrupo.materia) {
                                errores.push(`Inconsistencia: Profesor ${profesor.nombre} tiene ${bloqueProfesor.materia} para grupo ${bloqueProfesor.grupo} en ${dia} bloque ${bloque}, pero el grupo no tiene esta clase asignada`);
                            } else if (bloqueGrupo.materia !== bloqueProfesor.materia) {
                                errores.push(`Inconsistencia: Profesor ${profesor.nombre} y grupo ${bloqueProfesor.grupo} tienen materias diferentes en ${dia} bloque ${bloque}`);
                            }
                        }
                    }
                }
            }
        }

        return errores;
    }


    ////////////////////////////////////////////// EXPORTAR A JSON ////////////////////////////////////////////////////////

    exportarHorariosProfesoresJSON() {

        // horarios de profesores
        const horariosProfesor = {};
        for (const profesor of this.profesores) {
            horariosProfesor[profesor.nombre] = {
                horario: profesor.horario
            }
        };
        try {
            fs.writeFileSync('horarios_profesores.json', JSON.stringify(horariosProfesor, null, 2));
            console.log('Horarios de profesores guardados en: horarios_profesores.json');
            // Estadísticas generales
            const estadisticasGenerales = {
                total_profesores: this.profesores.length,
                total_grupos: this.grupos.length,
                total_materias: this.materias.length,
                bloques_matutino: this.config.bloques_matutino,
                bloques_vespertino: this.config.bloques_vespertino,
                fecha_generacion: new Date().toISOString()
            };

            fs.writeFileSync('estadisticas_generales.json', JSON.stringify(estadisticasGenerales, null, 2));
            console.log('Estadísticas generales guardadas en: estadisticas_generales.json');

        } catch (error) {
            console.error('Error al guardar archivos JSON:', error);
        }
    }

    exportarHorariosGrupalesJSON() {
        const horariosPorSemestre = this.generarHorariosPorSemestre();

        try {
            // Exportar todos los horarios grupales
            const horariosGrupales = {};
            for (const grupo of this.grupos) {
                horariosGrupales[grupo.nomenclatura] = {
                    grupo: grupo.nomenclatura,
                    semestre: grupo.semestre,
                    turno: grupo.turno,
                    carrera: grupo.carrera,
                    horario: grupo.horario
                };
            }

            fs.writeFileSync('horarios_grupales.json', JSON.stringify(horariosGrupales, null, 2));
            console.log('Horarios grupales guardados en: horarios_grupales.json');

            // Exportar por semestre
            fs.writeFileSync('horarios_por_semestre.json', JSON.stringify(horariosPorSemestre, null, 2));
            console.log('Horarios por semestre guardados en: horarios_por_semestre.json');

        } catch (error) {
            console.error('Error al guardar horarios grupales:', error);
        }
    }



    ////////////////////////////////////////// VISUALIZACION SOLO BORRAR DESPUES //////////////////////////////

    imprimirHorariosGrupales() {
        console.log("\n=== HORARIOS GRUPALES ===");

        // Agrupar por semestre
        const semestreGroups = {};
        for (const grupo of this.grupos) {
            if (!semestreGroups[grupo.semestre]) {
                semestreGroups[grupo.semestre] = [];
            }
            semestreGroups[grupo.semestre].push(grupo);
        }

        // Imprimir por semestre
        for (const semestre of Object.keys(semestreGroups).sort()) {
            console.log(`\n--- SEMESTRE ${semestre} ---`);

            for (const grupo of semestreGroups[semestre]) {
                console.log(`\nGrupo: ${grupo.nomenclatura} (${grupo.turno})`);
                console.log("Dia\t\tBloques");

                for (const dia of this.dias) {
                    let lineaDia = `${dia}\t\t`;

                    // Determinar el rango de bloques para este grupo
                    let bloqueInicio, bloqueFin;
                    if (grupo.turno === "Matutino") {
                        bloqueInicio = 1;
                        bloqueFin = this.config.bloque_fin_matutino;
                    } else if (grupo.turno === "Vespertino") {
                        bloqueInicio = this.config.bloque_inicio_vespertino;
                        bloqueFin = this.totalBloques;
                    } else {
                        bloqueInicio = 1;
                        bloqueFin = this.totalBloques;
                    }

                    for (let bloque = bloqueInicio; bloque <= bloqueFin; bloque++) {
                        const bloqueInfo = grupo.horario[dia][bloque];
                        if (bloqueInfo && bloqueInfo.materia) {
                            lineaDia += `[${bloque}:${bloqueInfo.materia.substring(0, 8)}] `;
                        } else {
                            lineaDia += `[${bloque}:-----] `;
                        }
                    }

                    console.log(lineaDia);
                }
            }
        }
    }

    imprimirAsignacionesProfesores() {
        console.log("\n=== ASIGNACIONES DE PROFESORES ===");

        for (const profesor of this.profesores) {
            console.log(`\nProfesor: ${profesor.nombre}`);
            let tieneAsignaciones = false;

            for (const dia of this.dias) {
                for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                    const bloqueInfo = profesor.horario[dia][bloque];
                    if (bloqueInfo.materia) {
                        console.log(`  ${dia} Bloque ${bloque}: ${bloqueInfo.materia} - Grupo ${bloqueInfo.grupo}`);
                        tieneAsignaciones = true;
                    }
                }
            }

            if (!tieneAsignaciones) {
                console.log("  No tiene asignaciones");
            }
        }
    }

    // FUNCIÓN DE DEBUG: Para ver la configuración de grupos
    imprimirConfiguracionGrupos() {
        console.log("\n=== CONFIGURACIÓN DE GRUPOS ===");

        for (const grupo of this.grupos) {
            console.log(`Grupo: ${grupo.nomenclatura}`);
            console.log(`  Semestre: ${grupo.semestre}`);
            console.log(`  Turno: ${grupo.turno}`);
            console.log(`  Especialidad: ${grupo.carrera || 'No especificada'}`);

            // Verificar rango de bloques
            let bloqueInicio, bloqueFin;
            if (grupo.turno === "Matutino") {
                bloqueInicio = 1;
                bloqueFin = this.config.bloque_fin_matutino;
            } else if (grupo.turno === "Vespertino") {
                bloqueInicio = this.config.bloque_inicio_vespertino;
                bloqueFin = this.totalBloques;
            } else {
                bloqueInicio = 1;
                bloqueFin = this.totalBloques;
            }

            console.log(`  Rango de bloques: ${bloqueInicio} - ${bloqueFin}`);
            console.log(`  Horario inicializado: ${grupo.horario ? 'Sí' : 'No'}`);
            console.log('');
        }
    }

}



/////////////////////////////////////////// PRUEBAS /////////////////////////////////////////////
const prueba = new GeneradorHorarios(materias, grupos, profesores, config);

// Mostrar configuración inicial
console.log("=== CONFIGURACIÓN INICIAL ===");
prueba.imprimirConfiguracionGrupos();

// Inicializar horarios de profesores
prueba.inicializarHorariosProfesores();

// Generar horarios de docentes
console.log("\n=== GENERANDO HORARIOS DE DOCENTES ===");
prueba.generarHorariosDocentes();

// Mostrar qué tienen asignado los profesores
prueba.imprimirAsignacionesProfesores();

// Generar horarios grupales con debug
console.log("\n=== GENERANDO HORARIOS GRUPALES ===");
prueba.generarHorariosGrupales();

// Imprimir horarios grupales
prueba.imprimirHorariosGrupales();

prueba.exportarHorariosGrupalesJSON();
prueba.exportarHorariosProfesoresJSON();




//TO DO
// verificar como se estan pasando los numeros de bloque al sistema y usar variables
// si el grupo no tiene turno se asigna donde sea para evitar romper el programa / tal vez cambiarlo linea 93

// 326 asignacion de materias a profesor cambiar el nombre de la funcion

// en la linea 80 agregar una funcion para poder contar el numero de materias de tronco comun que existen y las veces que se repiten
// para poder sacar la estadistica del numero de x materia que se necesita cubrir. tal vez solo con el numero de materias es capaz
// de poder obtener las horas ?
// esto es para asegurarse que se esten asignando todas las materias de los grupos o alguna validacion asi
// 219 verificar contarHorasMateriaPorDia() seria mas optimo si contara si hubo materia y no se asigne nada o contar el total de horas? verificar funcion
// entender calcularMaxHorasPorDia() 241
// entender profesorTieneGrupoParaMateria(), sintax equivocada o extrana
// 328 asignar materia, cambiar nombre o algo para cuando se asignen las materias al general no cause problema (puede que no cause problema pero para ser especifica)
// unificar las funciones de encontrar bloques consecutivos

// cuando un maestro no sea capaz de cubrir toda la carga horaria de la materia, no asignarle la materia 
// las horas de dual se toman como fortalecimiento academico porque no existe horario de dual
// aun no se como asignar tutorias si como fortalecimiento o materia

//si fortalecimiento academico es de tipo dual, escribir en grupo de la tabla de excel DUAL
// dual solo se puede los viernes