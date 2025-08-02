const fs = require('fs'); // módulo para leer archivos

// ================== Carga de datos ==================
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
        this.totalBloques = config.bloques_matutino + config.bloques_vespertino - 1;

        // Nuevo: estadísticas para mejor distribución
        this.estadisticasGrupos = new Map();
        this.inicializarEstadisticas();
    }

    inicializarEstadisticas() {
        this.grupos.forEach(grupo => {
            this.estadisticasGrupos.set(grupo.nomenclatura, {
                horasPorDia: { "Lunes": 0, "Martes": 0, "Miercoles": 0, "Jueves": 0, "Viernes": 0 },
                totalHoras: 0,
                horasMateriaAsignadas: new Map()
            });
        });
    }

    // ================== Creación de matrices ==================
    crearMatrizHorarioProfesores() {
        const matriz = {};
        for (let dia of this.dias) {
            matriz[dia] = {};
            for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                matriz[dia][bloque] = { materia: null, abreviatura: null, grupo: null, semestre: null };
            }
        }
        return matriz;
    }

    crearMatrizHorarioEscolar(grupo) {
        const matriz = {};
        let bloque_inicio, bloque_fin;
        if (grupo.turno === "Matutino") {
            bloque_inicio = 1;
            bloque_fin = this.config.bloque_fin_matutino;
        } else {
            bloque_inicio = this.config.bloque_inicio_vespertino;
            bloque_fin = this.totalBloques;
        }
        const total_bloques = bloque_fin - bloque_inicio + 1;
        for (let dia of this.dias) {
            matriz[dia] = {};
            for (let bloque = bloque_inicio; bloque <= bloque_fin; bloque++) {
                matriz[dia][bloque] = { materia: null, abreviatura: null, docente: null, aula: null };
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

    // ================== Utilidades de validación mejoradas ==================
    esMatutino(bloque) {
        return bloque <= this.config.bloque_fin_matutino;
    }

    esVespertino(bloque) {
        return bloque >= this.config.bloque_inicio_vespertino;
    }

    validarTurnoGrupo(grupo, bloque) {
        if (grupo.turno === "Matutino" && !this.esMatutino(bloque)) return false;
        if (grupo.turno === "Vespertino" && !this.esVespertino(bloque)) return false;
        return true;
    }

    grupoTieneClases(grupo, dia, bloque) {
        for (const profesor of this.profesores) {
            if (profesor.horario[dia][bloque].grupo === grupo.nomenclatura) return true;
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

    contarHorasMateriaTotalGrupo(grupo, materia) {
        let total = 0;
        const materiaId = materia.id || materia;
        const materiaInfo = this.materias.find(m => m.id === materiaId);
        const materiaNombre = materiaInfo ? materiaInfo.nombre : materiaId;

        for (const dia of this.dias) {
            total += this.contarHorasMateriaPorDia(grupo, materia, dia);
        }
        return total;
    }

    calcularMaxHorasPorDia(materia) {
        return materia.tipo === "modulo_profesional" ? 5 : 2;
    }

    cumpleRestricciones(dia, bloque, profesor, grupo, materia) {
        if (profesor.horario[dia][bloque].materia != null) return false;
        if (this.grupoTieneClases(grupo, dia, bloque)) return false;
        if (!this.validarTurnoGrupo(grupo, bloque)) return false;
        if (profesor.bloques_recomendados_no_asignar?.includes(bloque)) return false;

        if (materia) {
            const materiaObj = this.materias.find(m => m.id === (materia.id || materia));
            if (materiaObj) {
                const maxHorasPorDia = this.calcularMaxHorasPorDia(materiaObj);
                if (this.contarHorasMateriaPorDia(grupo, materia, dia) >= maxHorasPorDia) return false;

                // Nuevo: evitar concentrar todas las horas de una materia en pocos días
                const horasYaAsignadas = this.contarHorasMateriaTotalGrupo(grupo, materia);
                const horasEnEsteDia = this.contarHorasMateriaPorDia(grupo, materia, dia);

                // Si ya tiene horas en este día y hay otros días disponibles, preferir distribuir
                if (horasEnEsteDia > 0 && horasYaAsignadas < materiaObj.horas_semanales) {
                    const diasConEstaMateria = this.dias.filter(d =>
                        this.contarHorasMateriaPorDia(grupo, materia, d) > 0
                    ).length;

                    const maxDias = materiaObj.tipo === "modulo_profesional" ? 3 : 2;
                    // Solo aplicar el límite si ya se han completado todas las horas requeridas
                    if (diasConEstaMateria >= maxDias && horasYaAsignadas >= materiaObj.horas_semanales) {
                        return false;
                    }
                }
            }
        }

        const stats = this.estadisticasGrupos.get(grupo.nomenclatura);
        if (stats && stats.horasPorDia[dia] >= 8) return false; // Máximo 8 horas por día

        return true;
    }


    // ================== Asignación ==================
    asignarMateria(dia, bloque, profesor, grupo, materiaId) {
        const materia = this.materias.find(m => m.id === materiaId);
        profesor.horario[dia][bloque] = {
            materia: materia ? materia.nombre : materiaId,
            abreviatura: materia ? materia.abreviatura || null : null,
            grupo: grupo.nomenclatura,
            semestre: grupo.semestre
        };

        // Actualizar estadísticas
        const stats = this.estadisticasGrupos.get(grupo.nomenclatura);
        if (stats) {
            stats.horasPorDia[dia]++;
            stats.totalHoras++;
        }
    }

    encontrarBloquesConsecutivos(dia, profesor, grupo, materia, cantidadHoras) {
        for (let bloqueInicio = 1; bloqueInicio <= this.totalBloques - cantidadHoras + 1; bloqueInicio++) {
            let disponible = true;
            for (let i = 0; i < cantidadHoras; i++) {
                if (!this.cumpleRestricciones(dia, bloqueInicio + i, profesor, grupo, materia)) {
                    disponible = false;
                    break;
                }
            }
            if (disponible) return Array.from({ length: cantidadHoras }, (_, i) => bloqueInicio + i);
        }
        return null;
    }

    asignarBloquesConsecutivos(dia, profesor, grupo, materia, cantidadHoras) {
        const bloques = this.encontrarBloquesConsecutivos(dia, profesor, grupo, materia, cantidadHoras);
        if (!bloques) return false;
        for (const bloque of bloques) {
            const materiaId = materia ? (materia.id || materia) : null;
            this.asignarMateria(dia, bloque, profesor, grupo, materiaId);
        }
        return true;
    }

    // Nuevo: encontrar mejor día para asignar considerando balance
    encontrarMejorDiaParaAsignar(profesor, grupo, materia, cantidadHoras) {
        const diasDisponibles = [];

        for (const dia of this.dias) {
            const bloques = this.encontrarBloquesConsecutivos(dia, profesor, grupo, materia, cantidadHoras);
            if (bloques) {
                const stats = this.estadisticasGrupos.get(grupo.nomenclatura);
                const horasEnDia = stats ? stats.horasPorDia[dia] : 0;
                diasDisponibles.push({ dia, horasEnDia, bloques });
            }
        }

        // Ordenar por días con menos horas (mejor distribución)
        diasDisponibles.sort((a, b) => a.horasEnDia - b.horasEnDia);
        return diasDisponibles.length > 0 ? diasDisponibles[0] : null;
    }

    // ================== Asignar módulo profesional  ==================
    asignarModuloProfesional() {
        console.log("Iniciando asignación de módulos profesionales...");

        for (const profesor of this.profesores) {
            if (!profesor.materias) continue;

            for (const materiaProfesor of profesor.materias) {
                const materia = this.materias.find(m => m.id === materiaProfesor.id);
                if (!materia || materia.tipo !== "modulo_profesional") continue;

                const gruposAsignados = materiaProfesor.grupos_preferidos_asignar || [];

                for (const grupoNom of gruposAsignados) {
                    const grupo = this.grupos.find(g => g.nomenclatura === grupoNom);
                    if (!grupo) continue;

                    let horasAsignadas = 0;
                    console.log(`Asignando ${materia.nombre} (${materia.horas_semanales}h) a grupo ${grupoNom}`);

                    // Estrategia mejorada: bloques de 4, solo usar 5 cuando son 17 horas
                    while (horasAsignadas < materia.horas_semanales) {
                        let asignado = false;
                        const horasFaltantes = materia.horas_semanales - horasAsignadas;

                        let tamañoOptimo;
                        if (materia.horas_semanales === 17 && horasFaltantes === 5) {
                            // Caso especial: para 17 horas, usar un bloque de 5 al final
                            tamañoOptimo = 5;
                        } else {
                            // Priorizar bloques de 4
                            tamañoOptimo = Math.min(4, horasFaltantes);
                        }

                        for (let tam = tamañoOptimo; tam >= 1 && !asignado; tam--) {
                            const mejorDia = this.encontrarMejorDiaParaAsignar(profesor, grupo, materia, tam);
                            if (mejorDia) {
                                if (this.asignarBloquesConsecutivos(mejorDia.dia, profesor, grupo, materia, tam)) {
                                    horasAsignadas += tam;
                                    asignado = true;
                                    console.log(`  → Asignado ${tam}h en ${mejorDia.dia}`);
                                }
                            }
                        }

                        if (!asignado) {
                            console.warn(`  ⚠ No se pudieron asignar más horas para ${materia.nombre} al grupo ${grupoNom}. Asignadas: ${horasAsignadas}/${materia.horas_semanales}`);
                            break;
                        }
                    }
                }
            }
        }
    }

    // ================== Asignar tronco común  ==================
    asignarTroncoComun() {
        console.log("Iniciando asignación de tronco común...");

        for (const profesor of this.profesores) {
            if (!profesor.materias) continue;

            for (const materiaProfesor of profesor.materias) {
                const materia = this.materias.find(m => m.id === materiaProfesor.id);
                if (!materia || materia.tipo !== "tronco_comun") continue;

                const gruposAsignados = materiaProfesor.grupos_preferidos_asignar || [];

                for (const grupoNom of gruposAsignados) {
                    const grupo = this.grupos.find(g => g.nomenclatura === grupoNom);
                    if (!grupo) continue;

                    let horasAsignadas = 0;
                    console.log(`Asignando ${materia.nombre} (${materia.horas_semanales}h) a grupo ${grupoNom}`);

                    while (horasAsignadas < materia.horas_semanales) {
                        let asignado = false;
                        const horasFaltantes = materia.horas_semanales - horasAsignadas;

                        // Para tronco común, preferir bloques de 2 horas
                        let tamañoOptimo = Math.min(2, horasFaltantes);

                        for (let tam = tamañoOptimo; tam >= 1 && !asignado; tam--) {
                            const mejorDia = this.encontrarMejorDiaParaAsignar(profesor, grupo, materia, tam);
                            if (mejorDia) {
                                if (this.asignarBloquesConsecutivos(mejorDia.dia, profesor, grupo, materia, tam)) {
                                    horasAsignadas += tam;
                                    asignado = true;
                                    console.log(`  → Asignado ${tam}h en ${mejorDia.dia}`);
                                }
                            }
                        }

                        if (!asignado) {
                            console.warn(`  ⚠ No se pudieron asignar más horas para ${materia.nombre} al grupo ${grupoNom}. Asignadas: ${horasAsignadas}/${materia.horas_semanales}`);
                            break;
                        }
                    }
                }
            }
        }
    }

    // ================== Asignar extracurriculares  ==================
    asignarExtracurriculares() {
        console.log("Iniciando asignación de extracurriculares...");

        const profesoresExtracurriculares = this.profesores.filter(p =>
            p.horas_extracurriculares && p.horas_extracurriculares.length > 0
        );

        const semestres = [...new Set(this.grupos
            .filter(g => g.turno === "Matutino")
            .map(g => g.semestre)
        )].sort();

        console.log(`Semestres encontrados: ${semestres.join(', ')}`);

        for (const semestre of semestres) {
            console.log(`\nAsignando extracurricular para semestre ${semestre}...`);

            let horasNecesarias = 3;
            let diasAsignados = 0;

            for (const dia of this.dias) {
                if (diasAsignados >= horasNecesarias) break;

                let bloqueAsignado = null;

                // Buscar desde el último bloque matutino hacia el primero
                for (let bloque = this.config.bloque_fin_matutino; bloque >= 1; bloque--) {
                    const gruposDelSemestre = this.grupos.filter(g =>
                        g.semestre === semestre && g.turno === "Matutino"
                    );

                    const gruposDisponibles = gruposDelSemestre.every(g =>
                        !this.grupoTieneClases(g, dia, bloque)
                    );

                    const profesDisponibles = profesoresExtracurriculares.every(p =>
                        !p.horario[dia][bloque]?.materia
                    );

                    if (gruposDisponibles && profesDisponibles) {
                        bloqueAsignado = bloque;
                        break;
                    }
                }

                // Si no encontró en bloques altos, buscar en cualquier bloque libre
                if (!bloqueAsignado) {
                    for (let bloque = 1; bloque <= this.config.bloque_fin_matutino; bloque++) {
                        const gruposDelSemestre = this.grupos.filter(g =>
                            g.semestre === semestre && g.turno === "Matutino"
                        );

                        const gruposDisponibles = gruposDelSemestre.every(g =>
                            !this.grupoTieneClases(g, dia, bloque)
                        );

                        const profesDisponibles = profesoresExtracurriculares.every(p =>
                            !p.horario[dia][bloque]?.materia
                        );

                        if (gruposDisponibles && profesDisponibles) {
                            bloqueAsignado = bloque;
                            break;
                        }
                    }
                }

                // Si encontró un bloque, asignarlo a todos los profesores
                if (bloqueAsignado) {
                    profesoresExtracurriculares.forEach(p => {
                        const actividad = p.horas_extracurriculares[0];
                        p.horario[dia][bloqueAsignado] = {
                            materia: `Extracurricular: ${actividad.nombre} - ${semestre}° Semestre`,
                            abreviatura: actividad.abreviatura || null,
                            grupo: `Semestre ${semestre}`,
                            semestre: semestre
                        };
                    });

                    console.log(`  ✓ Asignado extracurricular semestre ${semestre} - ${dia} Bloque ${bloqueAsignado}`);
                    diasAsignados++;
                }
            }

            if (diasAsignados < horasNecesarias) {
                console.warn(`Solo se asignaron ${diasAsignados} de ${horasNecesarias} horas para extracurricular del semestre ${semestre}`);
            } else {
                console.log(`  ✅ Completadas ${horasNecesarias} horas de extracurricular para semestre ${semestre}`);
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

    // ================== Tutorías  ==================
    asignarTutorias() {
        console.log("Iniciando asignación de tutorías...");

        for (const grupo of this.grupos) {

            if (grupo.turno === "Vespertino" && grupo.semestre === 3) {
                console.log(`  → Grupo ${grupo.nomenclatura} no requiere tutorías, se omite.`);
                continue;
            }

            let asignado = false;
            console.log(`Asignando tutoría para grupo ${grupo.nomenclatura}...`);

            // PASO 1: Buscar profesores que YA dan clases a este grupo Y tienen horas de tutoría
            let profesoresPreferidos = this.profesores.filter(profesor => {
                const horasTutorias = profesor.horas_fortalecimiento_academico?.find(h =>
                    h.nombre === "Tutorías"
                )?.horas || 0;

                if (horasTutorias === 0) return false;

                // Contar tutorías ya asignadas
                let tutoriasYaAsignadas = 0;
                for (const dia of this.dias) {
                    for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                        if (profesor.horario[dia][bloque].materia === "Tutorías") {
                            tutoriasYaAsignadas++;
                        }
                    }
                }
                if (tutoriasYaAsignadas >= horasTutorias) return false;

                // Verificar que ya tenga materias asignadas con este grupo
                let tieneMateriaConGrupo = false;
                for (const dia of this.dias) {
                    for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                        if (profesor.horario[dia][bloque].grupo === grupo.nomenclatura &&
                            profesor.horario[dia][bloque].materia !== "Tutorías") {
                            tieneMateriaConGrupo = true;
                            break;
                        }
                    }
                    if (tieneMateriaConGrupo) break;
                }

                return tieneMateriaConGrupo;
            });

            // PASO 2: Si no hay profesores preferidos, buscar cualquier profesor con tutorías
            if (profesoresPreferidos.length === 0) {
                console.log(`  → No hay profesores que ya den clases al grupo ${grupo.nomenclatura}, buscando cualquier profesor con tutorías...`);

                profesoresPreferidos = this.profesores.filter(profesor => {
                    const horasTutorias = profesor.horas_fortalecimiento_academico?.find(h =>
                        h.nombre === "Tutorías"
                    )?.horas || 0;

                    if (horasTutorias === 0) return false;

                    let tutoriasYaAsignadas = 0;
                    for (const dia of this.dias) {
                        for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                            if (profesor.horario[dia][bloque].materia === "Tutorías") {
                                tutoriasYaAsignadas++;
                            }
                        }
                    }

                    return tutoriasYaAsignadas < horasTutorias;
                });
            }

            if (profesoresPreferidos.length === 0) {
                console.warn(`  ⚠ No se encontró profesor disponible con horas de tutoría para grupo ${grupo.nomenclatura}`);
                continue;
            }

            // Ordenar por carga actual (preferir menos cargados)
            profesoresPreferidos.sort((a, b) => {
                const horasA = this.calcularHorasAsignadasProfesor(a);
                const horasB = this.calcularHorasAsignadasProfesor(b);
                return horasA - horasB;
            });

            // PASO 3: Buscar horario disponible
            for (const profesor of profesoresPreferidos) {
                const diasOrdenados = [...this.dias].sort((a, b) => {
                    const stats = this.estadisticasGrupos.get(grupo.nomenclatura);
                    const horasA = stats ? stats.horasPorDia[a] : 0;
                    const horasB = stats ? stats.horasPorDia[b] : 0;
                    return horasA - horasB; // Preferir días con menos horas
                });

                for (const dia of diasOrdenados) {
                    let bloqueInicio, bloqueFin;
                    if (grupo.turno === "Matutino") {
                        bloqueInicio = 1;
                        bloqueFin = this.config.bloque_fin_matutino;
                    } else {
                        bloqueInicio = this.config.bloque_inicio_vespertino;
                        bloqueFin = this.totalBloques;
                    }

                    for (let bloque = bloqueInicio; bloque <= bloqueFin; bloque++) {
                        const profesorDisponible = !profesor.horario[dia][bloque].materia;
                        const grupoDisponible = !this.grupoTieneClases(grupo, dia, bloque);
                        const noEsHorarioRestringido = !(profesor.bloques_recomendados_no_asignar || []).includes(bloque);

                        if (profesorDisponible && grupoDisponible && noEsHorarioRestringido) {
                            profesor.horario[dia][bloque] = {
                                materia: "Tutorías",
                                abreviatura: "TUTOR", // o buscar en horas_fortalecimiento_academico del profe
                                grupo: grupo.nomenclatura,
                                semestre: grupo.semestre
                            };

                            // Actualizar estadísticas
                            const stats = this.estadisticasGrupos.get(grupo.nomenclatura);
                            if (stats) {
                                stats.horasPorDia[dia]++;
                                stats.totalHoras++;
                            }

                            console.log(`  ✓ Asignada tutoría: Grupo ${grupo.nomenclatura} con ${profesor.nombre} - ${dia} Bloque ${bloque}`);
                            asignado = true;
                            break;
                        }
                    }
                    if (asignado) break;
                }
                if (asignado) break;
            }

            if (!asignado) {
                console.warn(`  ⚠ No se pudo asignar tutoría al grupo ${grupo.nomenclatura}`);
            }
        }
    }


    // ================== Asignar fortalecimiento académico  ==================
    asignarFortalecimientoAcademico() {
        console.log("Iniciando asignación de fortalecimiento académico...");

        for (const profesor of this.profesores) {
            const actividades = profesor.horas_fortalecimiento_academico;

            if (!actividades || actividades.length == 0) continue;

            for (const actividad of actividades) {
                if (actividad.nombre === "Tutorías") continue;

                let horasPorAsignar = actividad.horas;
                console.log(`Asignando ${actividad.nombre} (${horasPorAsignar}h) a ${profesor.nombre}`);

                // Priorizar bloques recomendados de no asignar
                const bloquesPreferidos = profesor.bloques_recomendados_no_asignar || [];
                const todosLosBloques = Array.from({ length: this.totalBloques }, (_, i) => i + 1);

                // Ordenar: primero bloques preferidos, luego el resto
                const bloquesOrdenados = [
                    ...bloquesPreferidos,
                    ...todosLosBloques.filter(b => !bloquesPreferidos.includes(b))
                ];

                for (const dia of this.dias) {
                    if (horasPorAsignar <= 0) break;

                    for (const bloque of bloquesOrdenados) {
                        if (horasPorAsignar <= 0) break;

                        if (profesor.horario[dia][bloque].materia === null) {
                            profesor.horario[dia][bloque] = {
                                materia: actividad.nombre,
                                abreviatura: actividad.abreviatura || null,
                                grupo: null,
                                semestre: null
                            };
                            horasPorAsignar--;
                            console.log(`  → Asignado ${actividad.nombre} - ${dia} Bloque ${bloque}`);
                        }
                    }
                }

                if (horasPorAsignar > 0) {
                    console.warn(`  ⚠ Quedaron ${horasPorAsignar}h sin asignar de ${actividad.nombre} para ${profesor.nombre}`);
                }
            }
        }
    }

    // ================== Nuevo: Rellenar horas faltantes de profesores ==================
    completarHorasProfesores() {
        console.log("Completando horas faltantes de profesores...");

        for (const profesor of this.profesores) {
            const horasAsignadas = this.calcularHorasAsignadasProfesor(profesor);
            const horasTotales = profesor.horas_semanales_totales || 0;
            const horasFaltantes = horasTotales - horasAsignadas;

            if (horasFaltantes <= 0) continue;

            console.log(`Profesor ${profesor.nombre}: ${horasAsignadas}/${horasTotales} horas. Faltan: ${horasFaltantes}`);

            // Intentar asignar más horas de materias existentes primero
            let horasCompletadas = 0;

            if (profesor.materias) {
                for (const materiaProfesor of profesor.materias) {
                    if (horasCompletadas >= horasFaltantes) break;

                    const materia = this.materias.find(m => m.id === materiaProfesor.id);
                    if (!materia) continue;

                    const gruposAsignados = materiaProfesor.grupos_preferidos_asignar || [];

                    for (const grupoNom of gruposAsignados) {
                        if (horasCompletadas >= horasFaltantes) break;

                        const grupo = this.grupos.find(g => g.nomenclatura === grupoNom);
                        if (!grupo) continue;

                        // Verificar si ya se completaron las horas de esta materia
                        const horasYaAsignadas = this.contarHorasMateriaTotalGrupo(grupo, materia);
                        const horasFaltantesMateria = materia.horas_semanales - horasYaAsignadas;

                        if (horasFaltantesMateria <= 0) continue;

                        console.log(`  → Intentando completar ${materia.nombre} para ${grupoNom}: faltan ${horasFaltantesMateria}h`);

                        // Intentar asignar horas adicionales de esta materia
                        const maxTam = materia.tipo === "modulo_profesional" ? 4 : 2;

                        let horasAsignadasEstaMateria = 0;
                        while (horasAsignadasEstaMateria < horasFaltantesMateria && horasCompletadas < horasFaltantes) {
                            let asignado = false;

                            for (let tam = Math.min(maxTam, horasFaltantesMateria - horasAsignadasEstaMateria); tam >= 1; tam--) {
                                const mejorDia = this.encontrarMejorDiaParaAsignar(profesor, grupo, materia, tam);
                                if (mejorDia) {
                                    if (this.asignarBloquesConsecutivos(mejorDia.dia, profesor, grupo, materia, tam)) {
                                        horasAsignadasEstaMateria += tam;
                                        horasCompletadas += tam;
                                        console.log(`    ✓ Asignadas ${tam}h adicionales de ${materia.nombre} - ${mejorDia.dia}`);
                                        asignado = true;
                                        break;
                                    }
                                }
                            }

                            if (!asignado) break;
                        }
                    }
                }
            }

            // Si aún faltan horas, usar SOLO actividades de fortalecimiento académico específicas (NO apoyo general)
            const horasAunFaltantes = horasFaltantes - horasCompletadas;
            if (horasAunFaltantes > 0 && profesor.horas_fortalecimiento_academico) {
                console.log(`  → Asignando actividades de fortalecimiento académico específicas (${horasAunFaltantes}h)`);

                // Buscar actividades que no sean tutorías y tengan horas disponibles
                const actividadesDisponibles = profesor.horas_fortalecimiento_academico.filter(act => {
                    if (act.nombre === "Tutorías") return false;

                    // Contar cuántas horas ya están asignadas de esta actividad
                    let horasYaAsignadas = 0;
                    for (const dia of this.dias) {
                        for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                            if (profesor.horario[dia][bloque].materia === act.nombre) {
                                horasYaAsignadas++;
                            }
                        }
                    }

                    return horasYaAsignadas < act.horas;
                });

                let horasFortalecimiento = 0;
                for (const actividad of actividadesDisponibles) {
                    if (horasFortalecimiento >= horasAunFaltantes) break;

                    // Calcular horas disponibles de esta actividad
                    let horasYaAsignadas = 0;
                    for (const dia of this.dias) {
                        for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                            if (profesor.horario[dia][bloque].materia === actividad.nombre) {
                                horasYaAsignadas++;
                            }
                        }
                    }

                    const horasDisponiblesActividad = actividad.horas - horasYaAsignadas;
                    const horasPorAsignar = Math.min(horasDisponiblesActividad, horasAunFaltantes - horasFortalecimiento);

                    let horasAsignadasActividad = 0;
                    for (const dia of this.dias) {
                        if (horasAsignadasActividad >= horasPorAsignar) break;

                        for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                            if (horasAsignadasActividad >= horasPorAsignar) break;

                            if (profesor.horario[dia][bloque].materia === null) {
                                profesor.horario[dia][bloque] = {
                                    materia: actividad.nombre,
                                    abreviatura: actividad.abreviatura || null,
                                    grupo: null,
                                    semestre: null
                                };
                                horasAsignadasActividad++;
                                horasFortalecimiento++;
                                console.log(`    ✓ Asignada ${actividad.nombre} - ${dia} Bloque ${bloque}`);
                            }
                        }
                    }
                }

                // Si aún faltan horas después de usar todas las actividades específicas, reportar pero NO asignar apoyo general
                const horasFinalesFaltantes = horasAunFaltantes - horasFortalecimiento;
                if (horasFinalesFaltantes > 0) {
                    console.warn(`  ⚠ Quedan ${horasFinalesFaltantes}h sin asignar para ${profesor.nombre} - No hay más actividades de fortalecimiento específicas`);
                }
            } else if (horasAunFaltantes > 0) {
                console.warn(`  ⚠ Profesor ${profesor.nombre} no tiene actividades de fortalecimiento académico definidas. Quedan ${horasAunFaltantes}h sin asignar`);
            }
        }
    }

    // ================== Nuevo: Balancear distribución de horas por día ==================
    balancearDistribucionDiaria() {
        console.log("Balanceando distribución diaria de grupos...");

        for (const grupo of this.grupos) {
            const stats = this.estadisticasGrupos.get(grupo.nomenclatura);
            if (!stats) continue;

            console.log(`Grupo ${grupo.nomenclatura}:`);
            let totalHoras = 0;
            let diasConClases = 0;

            for (const dia of this.dias) {
                const horas = stats.horasPorDia[dia];
                console.log(`  ${dia}: ${horas} horas`);
                totalHoras += horas;
                if (horas > 0) diasConClases++;
            }

            const promedioHorasPorDia = diasConClases > 0 ? totalHoras / diasConClases : 0;
            console.log(`  Total: ${totalHoras}h, Promedio: ${promedioHorasPorDia.toFixed(1)}h/día activo`);

            // Identificar días con muy pocas horas
            const diasProblematicos = this.dias.filter(dia => {
                const horas = stats.horasPorDia[dia];
                return horas > 0 && horas < 4; // Menos de 4 horas en un día con clases
            });

            if (diasProblematicos.length > 0) {
                console.log(`  ⚠ Días con pocas horas: ${diasProblematicos.join(', ')}`);
            }
        }
    }

    // ================== Compactar horarios mejorado ==================
    reorganizarHorariosGrupalesYDocentes() {
        console.log("Reorganizando horarios grupales...");

        for (const grupo of this.grupos) {
            let bloqueInicio, bloqueFin;
            if (grupo.turno === "Matutino") {
                bloqueInicio = 1;
                bloqueFin = this.config.bloque_fin_matutino;
            } else {
                bloqueInicio = this.config.bloque_inicio_vespertino;
                bloqueFin = this.totalBloques;
            }

            for (const dia of this.dias) {
                let clases = [];
                for (let b = bloqueInicio; b <= bloqueFin; b++) {
                    if (grupo.horario[dia][b]?.materia) {
                        clases.push({
                            ...grupo.horario[dia][b],
                            bloqueOriginal: b
                        });
                    }
                }

                // Si no hay clases en este día, continuar
                if (clases.length === 0) continue;

                // Recolocar clases en bloques compactos
                clases.forEach((clase, i) => {
                    const nuevoBloque = bloqueInicio + i;
                    grupo.horario[dia][nuevoBloque] = {
                        materia: clase.materia,
                        abreviatura: clase.abreviatura,
                        docente: clase.docente,
                        aula: clase.aula
                    };

                    // Actualizar en el horario del profesor si es necesario
                    if (clase.docente) {
                        const profesor = this.profesores.find(p => p.nombre === clase.docente);
                        if (profesor && nuevoBloque !== clase.bloqueOriginal) {
                            // Limpiar bloque anterior
                            profesor.horario[dia][clase.bloqueOriginal] = { materia: null, abreviatura: null, grupo: null, semestre: null };
                            // Asignar nuevo bloque
                            profesor.horario[dia][nuevoBloque] = {
                                materia: clase.materia,
                                abreviatura: clase.abreviatura,
                                grupo: grupo.nomenclatura,
                                semestre: grupo.semestre
                            };
                        }
                    }
                });
            }
        }
    }

    // ================== Generar horarios principales ==================
    generarHorariosDocentes() {
        console.log("\n=== INICIALIZANDO HORARIOS DE PROFESORES ===");
        this.inicializarHorariosProfesores();
        this.inicializarHorariosEscolares();

        console.log("\n=== ASIGNANDO EXTRACURRICULARES ===");
        this.asignarExtracurriculares();

        console.log("\n=== ASIGNANDO MÓDULOS PROFESIONALES ===");
        this.asignarModuloProfesional();

        console.log("\n=== ASIGNANDO TRONCO COMÚN ===");
        this.asignarTroncoComun();

        console.log("\n=== ASIGNANDO TUTORÍAS ===");
        this.asignarTutorias();

        console.log("\n=== COMPLETANDO HORAS DE PROFESORES ===");
        this.completarHorasProfesores();

        console.log("\n=== ASIGNANDO FORTALECIMIENTO ACADÉMICO ===");
        this.asignarFortalecimientoAcademico();
    }

    generarHorariosGrupales() {
        console.log("\n=== GENERANDO HORARIOS GRUPALES ===");

        for (const profesor of this.profesores) {
            for (const dia of this.dias) {
                for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                    const bProfesor = profesor.horario[dia][bloque];

                    if (!bProfesor.materia) continue;

                    // Caso especial: extracurriculares
                    if (bProfesor.materia.toLowerCase().startsWith("extracurricular")) {
                        const semestre = bProfesor.semestre;
                        if (semestre) {
                            const gruposSemestre = this.grupos.filter(
                                g => g.semestre === semestre && g.turno === "Matutino"
                            );

                            for (const grupo of gruposSemestre) {
                                grupo.horario[dia][bloque] = {
                                    materia: "Extracurricular",
                                    abreviatura: null,
                                    docente: null,
                                    aula: null
                                };
                            }
                        }
                    }
                    // Caso normal
                    else if (bProfesor.grupo) {
                        const grupo = this.grupos.find(g => g.nomenclatura === bProfesor.grupo);
                        if (grupo && this.validarTurnoGrupo(grupo, bloque)) {
                            grupo.horario[dia][bloque] = {
                                materia: bProfesor.materia,
                                abreviatura: bProfesor.abreviatura,
                                docente: profesor.nombre,
                                aula: null
                            };
                        }
                    }
                }
            }
        }
    }


    // ================== Utilidades para estadísticas mejoradas ==================
    calcularHorasAsignadasProfesor(profesor) {
        let horas = 0;
        for (const dia of this.dias) {
            for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                if (profesor.horario[dia][bloque].materia) horas++;
            }
        }
        return horas;
    }

    calcularHuecosGrupo(grupo) {
        let huecos = 0;
        let bloqueInicio = grupo.turno === "Matutino" ? 1 : this.config.bloque_inicio_vespertino;
        let bloqueFin = grupo.turno === "Matutino" ? this.config.bloque_fin_matutino : this.totalBloques;

        for (const dia of this.dias) {
            let primerClase = null;
            let ultimaClase = null;
            for (let bloque = bloqueInicio; bloque <= bloqueFin; bloque++) {
                if (grupo.horario[dia][bloque]?.materia) {
                    if (primerClase === null) primerClase = bloque;
                    ultimaClase = bloque;
                }
            }
            if (primerClase !== null && ultimaClase !== null) {
                for (let bloque = primerClase; bloque <= ultimaClase; bloque++) {
                    if (!grupo.horario[dia][bloque]?.materia) huecos++;
                }
            }
        }
        return huecos;
    }

    // ================== Nuevo: Estadísticas detalladas ==================
    mostrarEstadisticasDetalladas() {
        console.log("\n=== ESTADÍSTICAS DETALLADAS ===");

        console.log("\n--- PROFESORES ---");
        let totalHorasAsignadas = 0;
        let totalHorasRequeridas = 0;

        for (const profesor of this.profesores) {
            const horasAsignadas = this.calcularHorasAsignadasProfesor(profesor);
            const horasRequeridas = profesor.horas_semanales_totales || 0;
            const porcentaje = horasRequeridas > 0 ? ((horasAsignadas / horasRequeridas) * 100).toFixed(1) : 0;

            totalHorasAsignadas += horasAsignadas;
            totalHorasRequeridas += horasRequeridas;

            console.log(`${profesor.nombre.padEnd(25)} | ${horasAsignadas.toString().padStart(2)}/${horasRequeridas.toString().padStart(2)} horas (${porcentaje}%)`);
        }

        const porcentajeGlobal = totalHorasRequeridas > 0 ? ((totalHorasAsignadas / totalHorasRequeridas) * 100).toFixed(1) : 0;
        console.log(`${'TOTAL'.padEnd(25)} | ${totalHorasAsignadas}/${totalHorasRequeridas} horas (${porcentajeGlobal}%)`);

        console.log("\n--- GRUPOS ---");
        for (const grupo of this.grupos) {
            const stats = this.estadisticasGrupos.get(grupo.nomenclatura);
            const huecos = this.calcularHuecosGrupo(grupo);

            console.log(`${grupo.nomenclatura.padEnd(15)} | Total: ${stats.totalHoras.toString().padStart(2)}h | Huecos: ${huecos} | Distribución: ${this.dias.map(dia => `${dia.substr(0, 3)}:${stats.horasPorDia[dia]}`).join(' ')}`);
        }

        console.log("\n--- RESUMEN POR MATERIA ---");
        const resumenMaterias = new Map();

        for (const profesor of this.profesores) {
            for (const dia of this.dias) {
                for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                    const asignacion = profesor.horario[dia][bloque];
                    if (asignacion.materia && asignacion.grupo) {
                        const key = `${asignacion.materia}-${asignacion.grupo}`;
                        if (!resumenMaterias.has(key)) {
                            resumenMaterias.set(key, 0);
                        }
                        resumenMaterias.set(key, resumenMaterias.get(key) + 1);
                    }
                }
            }
        }

        for (const [key, horas] of resumenMaterias) {
            const [materia, grupo] = key.split('-');
            console.log(`${materia.padEnd(30)} | ${grupo.padEnd(10)} | ${horas}h`);
        }
    }

    mostrarEstadisticas() {
        this.mostrarEstadisticasDetalladas();
    }

    imprimirHorariosGrupales() {
        console.log("\n=== HORARIOS GRUPALES ===");
        for (const grupo of this.grupos) {
            console.log(`\n📋 Grupo ${grupo.nomenclatura} (${grupo.turno})`);
            console.log("═".repeat(80));

            for (const dia of this.dias) {
                let linea = `${dia.padEnd(10)}: `;
                let bloqueInicio = grupo.turno === "Matutino" ? 1 : this.config.bloque_inicio_vespertino;
                let bloqueFin = grupo.turno === "Matutino" ? this.config.bloque_fin_matutino : this.totalBloques;

                for (let bloque = bloqueInicio; bloque <= bloqueFin; bloque++) {
                    const materia = grupo.horario[dia][bloque]?.materia || "-----";
                    linea += `[${bloque}:${materia.substr(0, 8).padEnd(8)}] `;
                }
                console.log(linea);
            }
        }
    }

    imprimirAsignacionesProfesores() {
        console.log("\n=== HORARIOS PROFESORES ===");
        for (const profesor of this.profesores) {
            console.log(`\n👨‍🏫 Profesor: ${profesor.nombre}`);
            console.log("═".repeat(60));

            for (const dia of this.dias) {
                console.log(`\n${dia}:`);
                for (let bloque = 1; bloque <= this.totalBloques; bloque++) {
                    const bInfo = profesor.horario[dia][bloque];
                    if (bInfo.materia) {
                        console.log(`  Bloque ${bloque}: ${bInfo.materia.padEnd(25)} - ${bInfo.grupo || 'N/A'}`);
                    }
                }
            }
        }
    }

    // ================== Exportación mejorada ==================
    exportarHorariosGrupalesJSON() {
        const horariosGrupales = {};
        for (const grupo of this.grupos) {
            const stats = this.estadisticasGrupos.get(grupo.nomenclatura);
            horariosGrupales[grupo.nomenclatura] = {
                grupo: grupo.nomenclatura,
                semestre: grupo.semestre,
                turno: grupo.turno,
                carrera: grupo.carrera,
                horario: grupo.horario,
                estadisticas: {
                    huecos: this.calcularHuecosGrupo(grupo),
                    totalHoras: stats?.totalHoras || 0,
                    horasPorDia: stats?.horasPorDia || {},
                    promedioDiario: stats ? (stats.totalHoras / this.dias.filter(dia => stats.horasPorDia[dia] > 0).length).toFixed(1) : 0
                }
            };
        }
        fs.writeFileSync('horarios_grupales.json', JSON.stringify(horariosGrupales, null, 2));
        console.log("✅ Horarios grupales exportados a horarios_grupales.json");
    }

    exportarHorariosProfesoresJSON() {
        const horariosProfesor = {};
        for (const profesor of this.profesores) {
            const horasAsignadas = this.calcularHorasAsignadasProfesor(profesor);
            horariosProfesor[profesor.nombre] = {
                horario: profesor.horario,
                estadisticas: {
                    horasAsignadas: horasAsignadas,
                    horasRequeridas: profesor.horas_semanales_totales || 0,
                    porcentajeCompletado: profesor.horas_semanales_totales > 0 ?
                        ((horasAsignadas / profesor.horas_semanales_totales) * 100).toFixed(1) : 0
                }
            };
        }
        fs.writeFileSync('horarios_profesores.json', JSON.stringify(horariosProfesor, null, 2));
        console.log("✅ Horarios profesores exportados a horarios_profesores.json");
    }

    // ================== Nuevo: Proceso principal optimizado ==================
    ejecutarGeneracionCompleta() {
        console.log("🚀 INICIANDO GENERACIÓN OPTIMIZADA DE HORARIOS");
        console.log("═".repeat(60));

        this.generarHorariosDocentes();
        this.generarHorariosGrupales();

        console.log("\n=== BALANCEANDO DISTRIBUCIÓN ===");
        this.balancearDistribucionDiaria();

        console.log("\n=== REORGANIZANDO HORARIOS ===");
        this.reorganizarHorariosGrupalesYDocentes();

        console.log("\n=== ESTADÍSTICAS FINALES ===");
        this.mostrarEstadisticas();

        console.log("\n=== EXPORTANDO RESULTADOS ===");
        this.exportarHorariosGrupalesJSON();
        this.exportarHorariosProfesoresJSON();

        console.log("\n✅ Generación de horarios completada exitosamente");
        return true;
    }
}

// ================== EJECUCIÓN DEL PROGRAMA ==================
function ejecutarGeneracion() {
    let generacionLista = false;

    try {
        const generador = new GeneradorHorarios(materias, grupos, profesores, config);
        generador.ejecutarGeneracionCompleta();

        // Mostrar horarios en consola
        generador.imprimirHorariosGrupales();
        generador.imprimirAsignacionesProfesores();

        generacionLista = true;
        console.log("Generación de horarios completada ");
    } catch (error) {
        console.error("Error durante la generación de horarios:", error);
        process.exit(1);
    }

    return generacionLista;
}

// ================== PRUEBA Y DEBUG ==================
try {
    const generador = new GeneradorHorarios(materias, grupos, profesores, config);
    generador.ejecutarGeneracionCompleta();

    // Mostrar horarios en consola
    generador.imprimirHorariosGrupales();
    generador.imprimirAsignacionesProfesores();

    console.log("Generación de horarios completada ");
} catch (error) {
    console.error("Error durante la generación de horarios:", error);
    process.exit(1);
}