const fs = require('fs'); //modulo para leer archivos

const materias = JSON.parse(fs.readFileSync("materias.json", "utf8"));
const grupos = JSON.parse(fs.readFileSync("grupos.json", "utf8"));
const profesores = JSON.parse(fs.readFileSync("profesores.json", "utf8"));
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));


class GeneradorHorarios {
    constructor(materias, grupos, profesores, config) {
        this.materias = materias;
        this.grupos = grupos;
        this.profesores = profesores;
        this.config = config;
        this.dias = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"];
        this.totalBloques = config.bloques_matutino + config.bloques_vespertino - 1; //se resta uno porque el 8vo bloque matutino es el 1ro vespertino 
        this.bloques_recomendados_mod_profesional = [4, 4, 4, 5];
    }

    /////////////////////////////////////// CREACION DE MATRICES ////////////////////////////////////////////

    crearMatrizHorarioProfesores() {
        const matriz = {};
        for (let dia of this.dias) {
            matriz[dia] = {};
            for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
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

        if (grupo.turno === "Matutino") {
            bloque_inicio = 1;
            bloque_fin = this.config.bloque_fin_matutino;
        }
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

    inicializarHorariosProfesores() {
        for (const profesor of this.profesores) {
            profesor.horario = this.crearMatrizHorarioProfesores();
        }
    }

    inicializarHorariosEscolares() {
        for (const grupo of this.grupos) {
            const resultado = this.crearMatrizHorarioEscolar(grupo);
            grupo.horario = resultado.matriz;
            grupo.total_bloques = resultado.total_bloques;
        }
    }

    ///////////////////////////// FUNCIONES PARA IDENTIFICAR BLOQUES DE TURNOS ///////////////////////////////////////

    esMatutino(bloque) {
        return bloque <= this.config.bloque_fin_matutino;
    }

    esVespertino(bloque) {
        return bloque >= this.config.bloque_inicio_vespertino;
    }

    ////////////////////////////////////////// GENERAR HORARIOS ///////////////////////////////////////////

    generarHorariosDocentes() {
        this.inicializarHorariosProfesores();
        this.asignarExtracurriculares();
        this.asignarModuloProfesional();
        this.asignarTroncoComun();
        this.asignarFortalecimientoAcademico();
    }

    generarHorariosGrupales() {
        this.inicializarHorariosEscolares();
        console.log("Iniciando generación de horarios grupales...");

        for (const profesor of this.profesores) {
            for (const dia of this.dias) {
                for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                    const bloqueProfesor = profesor.horario[dia][bloque];

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

                            if (this.validarTurnoGrupo(grupo, bloque)) {
                                grupo.horario[dia][bloque] = {
                                    materia: bloqueProfesor.materia,
                                    docente: profesor.nombre,
                                    aula: null
                                };
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
        this.asignarExtracurricularesAGrupos();
        console.log("Generación de horarios grupales completada.");
    }

    generarHorariosPorSemestre() {
        this.generarHorariosGrupales();
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

    cumpleRestricciones(dia, bloque, profesor, grupo, materia) {
        if (profesor.horario[dia][bloque].materia != null) {
            return false;
        }

        if (this.grupoTieneClases(grupo, dia, bloque)) {
            return false;
        }

        if (!this.validarTurnoGrupo(grupo, bloque)) {
            return false;
        }

        if (profesor.bloques_recomendados_no_asignar && profesor.bloques_recomendados_no_asignar.includes(bloque)) {
            return false;
        }

        if (materia) {
            const materiaInfo = this.materias.find(m => m.id === materia.id || m.id === materia);
            if (materiaInfo && materiaInfo.semestre && materiaInfo.semestre != grupo.semestre) {
                return false;
            }
        }

        if (materia && this.grupoTuvoPorDia(grupo, materia, dia)) {
            return false;
        }

        if (materia) {
            const materiaObj = this.materias.find(m => m.id === (materia.id || materia));
            if (materiaObj) {
                const maxHorasPorDia = this.calcularMaxHorasPorDia(materiaObj);
                if (this.contarHorasMateriaPorDia(grupo, materia, dia) >= maxHorasPorDia) {
                    return false;
                }
            }
        }
        return true;
    }

    grupoTieneClases(grupo, dia, bloque) {
        for (const profesor of this.profesores) {
            if (profesor.horario[dia][bloque].grupo === grupo.nomenclatura) {
                return true;
            }
        }
        return false;
    }

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

    grupoTuvoPorDia(grupo, materia, dia) {
        return this.contarHorasMateriaPorDia(grupo, materia, dia) > 0;
    }

    calcularMaxHorasPorDia(materia) {
        if (materia.tipo === "modulo_profesional") {
            return 5;
        }

        if (materia.horas_semanales <= 2) {
            return 1;
        }
        return 2;
    }

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

    validarTurnoGrupo(grupo, bloque) {
        if (grupo.turno === "Matutino" && !this.esMatutino(bloque)) {
            return false;
        }
        if (grupo.turno === "Vespertino" && !this.esVespertino(bloque)) {
            return false;
        }
        return true;
    }

    ////////////////////////////////////// FUNCIONES PARA ASIGNAR MATERIAS/////////////////////////////////////////

    asignarMateria(dia, bloque, profesor, grupo, materiaId) {
        const materia = this.materias.find(m => m.id === materiaId);
        profesor.horario[dia][bloque] = {
            materia: materia ? materia.nombre : materiaId,
            grupo: grupo.nomenclatura,
            semestre: grupo.semestre
        }
    }

    asignarExtracurriculares() {
        // Obtener profesores con extracurriculares
        const profesoresExtracurriculares = this.profesores.filter(p =>
            p.horas_extracurriculares && p.horas_extracurriculares.length > 0
        );

        // Agrupar grupos matutinos por semestre
        const gruposPorSemestre = {};
        for (const grupo of this.grupos) {
            if (grupo.turno === "Matutino") {
                if (!gruposPorSemestre[grupo.semestre]) {
                    gruposPorSemestre[grupo.semestre] = [];
                }
                gruposPorSemestre[grupo.semestre].push(grupo);
            }
        }

        // Asignar extracurriculares por semestre
        for (const [semestre, grupos] of Object.entries(gruposPorSemestre)) {
            let horasAsignadas = 0;

            // Buscar profesor con horas disponibles para extracurricular
            const profesorExtracurricular = profesoresExtracurriculares.find(p => {
                const actividad = p.horas_extracurriculares?.[0];
                const horasUsadas = this.contarHorasExtracurricularAsignadas(p, actividad?.nombre);
                return actividad && actividad.horas > horasUsadas;
            });

            if (!profesorExtracurricular) {
                console.log(`No se encontró profesor disponible con horas extracurriculares para semestre ${semestre}`);
                continue;
            }

            const extracurricular = profesorExtracurricular.horas_extracurriculares[0];
            const horasNecesarias = 3; // Siempre se quieren 3 horas por semana

            for (const dia of this.dias) {
                if (horasAsignadas >= horasNecesarias) break;

                // Buscar último bloque disponible desde el final hacia atrás
                for (let bloque = this.config.bloque_fin_matutino; bloque >= 1; bloque--) {
                    const disponibleProfesor = !profesorExtracurricular.horario[dia][bloque]?.materia;
                    const todosGruposDisponibles = grupos.every(g => !this.grupoTieneClases(g, dia, bloque));

                    if (disponibleProfesor && todosGruposDisponibles) {
                        profesorExtracurricular.horario[dia][bloque] = {
                            materia: `Extracurricular: ${extracurricular.nombre} - ${semestre}° Semestre`,
                            grupo: `Semestre ${semestre}`,
                            semestre: semestre
                        };

                        console.log(`Asignado extracurricular: ${extracurricular.nombre} - Semestre ${semestre} - ${dia} Bloque ${bloque}`);
                        horasAsignadas++;
                        break; // Solo una hora por día
                    }
                }
            }

            if (horasAsignadas < horasNecesarias) {
            console.log(`Advertencia: Solo se asignaron ${horasAsignadas} de 3 horas para extracurricular del semestre ${semestre}`);
            }
        }
    }

    contarHorasExtracurricularAsignadas(profesor, nombreActividad) {
        let total = 0;
        for (const dia of this.dias) {
            for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                const entrada = profesor.horario[dia][bloque];
                if (entrada?.materia?.toLowerCase().includes(nombreActividad.toLowerCase())) {
                    total++;
                }   
            }
        }
        return total;
    }

    asignarExtracurricularesAGrupos() {
        for (const profesor of this.profesores) {
            if (!profesor.horas_extracurriculares || profesor.horas_extracurriculares.length === 0) continue;

            for (const dia of this.dias) {
                for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                    const asignacion = profesor.horario[dia][bloque];

                    if (
                        asignacion &&
                        asignacion.materia &&
                        asignacion.materia.toLowerCase().includes("extracurricular") &&
                        asignacion.grupo?.toLowerCase().includes("semestre")
                    ) {
                        const semestre = parseInt(asignacion.grupo.match(/\d+/)?.[0]);

                        if (!semestre) continue;

                        const gruposDelSemestre = this.grupos.filter(
                            g => g.semestre === semestre && g.turno === "Matutino"
                        );

                        for (const grupo of gruposDelSemestre) {
                            if (this.validarTurnoGrupo(grupo, bloque)) {
                                grupo.horario[dia][bloque] = {
                                    materia: "Extracurricular",
                                    docente: null,
                                    aula: null
                                };
                                console.log(`Asignado Extracurricular al grupo ${grupo.nomenclatura} - ${dia} Bloque ${bloque}`);
                            }
                        }
                    }
                }
            }
        }
    }

    asignarModuloProfesional() {
        for (const profesor of this.profesores) {
            // Revisar si el profesor tiene materias asignadas
            if (!profesor.materias || profesor.materias.length === 0) continue;

            for (const materiaProfesor of profesor.materias) {
                const materia = this.materias.find(m => m.id === materiaProfesor.id);
                if (!materia || materia.tipo != "modulo_profesional") continue;

                // Obtener grupos asignados para esta materia
                const gruposAsignados = materiaProfesor.grupos_preferidos_asignar || [];

                for (const grupoNomenclatura of gruposAsignados) {
                    const grupo = this.grupos.find(g => g.nomenclatura === grupoNomenclatura);
                    if (!grupo) {
                        console.log(`Grupo ${grupoNomenclatura} no encontrado`);
                        continue;
                    }

                    // Validación de semestre y carrera
                    if (materia.semestre && grupo.semestre != materia.semestre) continue;
                    if (materia.carrera && grupo.carrera != materia.carrera) continue;

                    let bloqueAsignado = false;

                    // Intentar asignar cada bloque de horas recomendado
                    for (const cantidadHoras of this.bloques_recomendados_mod_profesional) {
                        let asignadoEsteBloque = false;

                        for (const dia of this.dias) {
                            const horasActualesEnDia = this.contarHorasMateriaPorDia(grupo, materia, dia);
                            const maxHorasPorDia = this.calcularMaxHorasPorDia(materia);

                            if (horasActualesEnDia + cantidadHoras > maxHorasPorDia) {
                                continue;
                            }

                            if (this.asignarBloquesConsecutivos(dia, profesor, grupo, materia, cantidadHoras)) {
                                asignadoEsteBloque = true;
                                bloqueAsignado = true;
                                break;
                            }
                        }

                        if (!asignadoEsteBloque) {
                            console.log(`No se pudo asignar bloque de ${cantidadHoras} horas para ${materia.nombre} al grupo ${grupo.nomenclatura}`);
                            break;
                        }
                    }

                    if (bloqueAsignado) {
                        console.log(`Asignado módulo profesional: ${materia.nombre} al grupo ${grupo.nomenclatura}`);
                    }
                }
            }
        }
    }

    asignarTroncoComun() {
        for (const profesor of this.profesores) {
            if (!profesor.materias || profesor.materias.length === 0) continue;

            for (const materiaProfesor of profesor.materias) {
                const materia = this.materias.find(m => m.id === materiaProfesor.id);
                if (!materia || materia.tipo != "tronco_comun") continue;

                // Obtener grupos asignados para esta materia
                const gruposAsignados = materiaProfesor.grupos_preferidos_asignar || [];

                for (const grupoNomenclatura of gruposAsignados) {
                    const grupo = this.grupos.find(g => g.nomenclatura === grupoNomenclatura);
                    if (!grupo) {
                        console.log(`Grupo ${grupoNomenclatura} no encontrado`);
                        continue;
                    }

                    if (materia.semestre && grupo.semestre != materia.semestre) continue;

                    // Calcular cuántas horas necesitamos asignar
                    const horasAsignadas = this.contarHorasAsignadasGrupoMateria(grupo, materia);
                    const horasRestantes = materia.horas_semanales - horasAsignadas;

                    if (horasRestantes <= 0) continue;

                    let asignacionExitosa = false;

                    // Intentar asignar en bloques de 2 horas primero
                    while (this.contarHorasAsignadasGrupoMateria(grupo, materia) < materia.horas_semanales) {
                        const horasRestantesFinal = materia.horas_semanales - this.contarHorasAsignadasGrupoMateria(grupo, materia);
                        
                        if (horasRestantesFinal >= 2) {
                            let asignadoBloque2 = false;

                            for (const dia of this.dias) {
                                if (this.asignarBloquesConsecutivosTroncoComun(dia, profesor, grupo, materia, 2)) {
                                    asignadoBloque2 = true;
                                    asignacionExitosa = true;
                                    break;
                                }
                            }

                            if (!asignadoBloque2) break;
                        } else {
                            // Asignar horas sueltas
                            let asignadoHora = false;

                            for (const dia of this.dias) {
                                if (this.grupoTuvoPorDia(grupo, materia, dia)) continue;

                                for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                                    if (this.cumpleRestricciones(dia, bloque, profesor, grupo, materia)) {
                                        this.asignarMateria(dia, bloque, profesor, grupo, materiaProfesor.id);
                                        asignadoHora = true;
                                        asignacionExitosa = true;
                                        break;
                                    }
                                }
                                if (asignadoHora) break;
                            }
                            if (!asignadoHora) break;
                        }
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

            if (!actividades || actividades.length == 0) continue;

            for (const actividad of actividades) {
                let horasPorAsignar = actividad.horas;

                for (const dia of this.dias) {
                    if (horasPorAsignar <= 0) break;

                    for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                        if (horasPorAsignar <= 0) break;

                        if (profesor.horario[dia][bloque].materia === null) {
                            // Asignar en bloques recomendados de no asignar si están disponibles
                            if (profesor.bloques_recomendados_no_asignar && 
                                profesor.bloques_recomendados_no_asignar.includes(bloque)) {
                                profesor.horario[dia][bloque] = {
                                    materia: actividad.nombre,
                                    grupo: null,
                                    semestre: null
                                };
                                horasPorAsignar--;
                                console.log(`Asignado fortalecimiento académico: ${actividad.nombre} - ${profesor.nombre} - ${dia} Bloque ${bloque}`);
                            }
                            // Si no hay bloques recomendados o ya se llenaron, asignar en cualquier bloque libre
                            else if (!profesor.bloques_recomendados_no_asignar || 
                                     profesor.bloques_recomendados_no_asignar.length === 0) {
                                profesor.horario[dia][bloque] = {
                                    materia: actividad.nombre,
                                    grupo: null,
                                    semestre: null
                                };
                                horasPorAsignar--;
                                console.log(`Asignado fortalecimiento académico: ${actividad.nombre} - ${profesor.nombre} - ${dia} Bloque ${bloque}`);
                            }
                        }
                    }
                }
            }
        }
    }

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

    encontrarBloquesConsecutivos(dia, profesor, grupo, cantidadHoras) {
        const totalBloques = this.totalBloques;

        for (let bloqueInicio = 1; bloqueInicio <= totalBloques - cantidadHoras + 1; bloqueInicio++) {
            let disponible = true;

            for (let i = 0; i < cantidadHoras; i++) {
                const bloqueActual = bloqueInicio + i;

                if (!this.cumpleRestricciones(dia, bloqueActual, profesor, grupo, null)) {
                    disponible = false;
                    break;
                }
            }

            if (disponible) {
                return {
                    inicio: bloqueInicio,
                    fin: bloqueInicio + cantidadHoras - 1,
                    bloques: Array.from({ length: cantidadHoras }, (_, i) => bloqueInicio + i)
                };
            }
        }

        return null;
    }

    encontrarBloquesConsecutivosTroncoComun(dia, profesor, grupo, materia, cantidadHoras) {
        const totalBloques = this.totalBloques;

        for (let bloqueInicio = 1; bloqueInicio <= totalBloques - cantidadHoras + 1; bloqueInicio++) {
            let disponible = true;

            for (let i = 0; i < cantidadHoras; i++) {
                const bloqueActual = bloqueInicio + i;

                if (!this.cumpleRestricciones(dia, bloqueActual, profesor, grupo, materia)) {
                    disponible = false;
                    break;
                }
            }

            if (disponible) {
                return {
                    inicio: bloqueInicio,
                    fin: bloqueInicio + cantidadHoras - 1,
                    bloques: Array.from({ length: cantidadHoras }, (_, i) => bloqueInicio + i)
                };
            }
        }

        return null;
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

 ///////////////////////////////////////////// METODOS PARA VALIDACION Y DEBUG ////////////////////////////////////////////
     //                                             validar factibilidad del horario

    
    verificarConsistenciaHoras(profesor) {
    const horasFort = profesor.horas_fortalecimiento_academico?.reduce((t, h) => t + h.horas, 0) || 0;
    const horasExtra = profesor.horas_extracurriculares?.reduce((t, h) => t + h.horas, 0) || 0;
    const horasDual = profesor.horas_dual?.reduce((t, h) => t + h.horas_semanales, 0) || 0;
    const horasMaterias = this.calcularHorasAsignadasProfesor(profesor);

    const total = horasFort + horasExtra + horasDual + horasMaterias;

    return {
        esperado: profesor.horas_semanales_totales,
        calculado: total,
        diferencia: profesor.horas_semanales_totales - total
    };
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
}
 
 /////////////////////////////////////////// PRUEBAS /////////////////////////////////////////////
const prueba = new GeneradorHorarios(materias, grupos, profesores, config);

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
 

 
 
//TO DO LIMPIEZA DE CODIGO
// unificar las funciones de encontrar bloques consecutivos

// TO DO FUNCIONAL
// problemas con asignacion de modulo profesional para 5 semestre vesperino 508h 503k 506f 501i 504d, 502b (probablemente porque no es de 17 hrs sino de 12 solo)
// no existe asignacion correcta de tutorias aun
// hacer que el horario no cree huecos en horarios de alumnos y si sobran horas mejor disminuir en otros dias o quitar algun dia 