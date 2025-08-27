# Generador de Horarios – Motor de Asignación (CLI)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248)
![Estado](https://img.shields.io/badge/Status-Activo-brightgreen)

Motor **en consola** para asignar materias a grupos y profesores respetando reglas básicas de horario.  
Puede funcionar en dos modos:
1) **Conexión a MongoDB Atlas**  
2) **Archivos locales JSON** (sin base de datos)

> **Alcance**: Este repositorio contiene **únicamente el motor de asignación** (backend/CLI).  
> La app de escritorio/web del equipo (Quasar/Electron) vive en otro repo; este módulo se integra como generador de horarios.

# Características
- Asigna materias a grupos y profesores aplicando reglas de disponibilidad.
- Evita choques de profesor/grupo por bloque y día.
- Exporta resultados en JSON para **grupos** y **profesores**.
- Intercambiable: **DB Atlas** o **JSON locales** según `.env`.
- Estructura simple (Node.js) y lista para integrar en otras apps.

# Estructura
├─ filesToAvoidUsingDB/ # Datos de ejemplo si NO usas Atlas
├─ models/ # Esquemas/entidades
├─ db.js # Conexión y operaciones a MongoDB (si DB_MODE=atlas)
├─ index.js # Punto de entrada CLI (ejecución del algoritmo)
├─ horarios_grupales.json # Salida: horarios por grupo
├─ horarios_profesores.json # Salida: horarios por profesor
├─ .gitignore
└─ README.md

----------------------
# Requisitos
- **Node.js 18+**
- (Opcional) Cuenta y cluster en **MongoDB Atlas**

# Configuración
**A) Usando MongoDB Atlas**
1. Crea un archivo `.env` en la raíz con una de estas opciones:
```env
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority&appName=<cluster-name>
2. Comenta la línea 75 en index.js y descomenta la línea 74

**B) Usando MongoDB Atlas**
1. Comenta la línea 74 en index.js y descomenta la línea 75

# Ejecución
1. Instala moongose en caso de usar MongoDB
 npm install mongoose
2. Ejecuta el programa usando el siguiente comando en consola.
 node index.js

# Proyecto completo (UI)
La interfaz completa del proyecto (Quasar/Electron) está en otro repositorio.
https://github.com/Luciel6ZTB/chronotables-v1


