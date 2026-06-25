# Requirements Document

## Introduction

ApexVision AI es una plataforma construida 100% sobre servicios AWS que ingesta video/frames de carreras de Fórmula 1, extrae métricas en tiempo real y, mediante Inteligencia Artificial Generativa y modelos de Machine Learning, calcula métricas de rendimiento de pilotos y vehículos, predice estrategias óptimas, detecta problemas de rendimiento y presenta toda la analítica en un dashboard en tiempo real.

## Glossary

- **Sistema_Ingestion**: Subsistema responsable de la ingesta de video y frames en tiempo real desde fuentes de cámara de F1, basado en Amazon Kinesis Video Streams y Kinesis Data Streams.
- **Sistema_Vision**: Subsistema de procesamiento visual que ejecuta detección de objetos y segmentación sobre frames utilizando Amazon Rekognition y/o modelos personalizados en Amazon SageMaker.
- **Sistema_Metricas**: Subsistema de extracción de métricas frame-a-frame que calcula indicadores de rendimiento del piloto y vehículo (líneas de carrera, velocidad aparente, frenado, desgaste estimado).
- **Sistema_GenAI**: Subsistema de Inteligencia Artificial Generativa basado en Amazon Bedrock que produce insights en lenguaje natural, recomendaciones estratégicas y resúmenes.
- **Sistema_Prediccion**: Subsistema de modelos predictivos en Amazon SageMaker para estrategia de carrera y detección de anomalías de rendimiento.
- **Sistema_Dashboard**: Interfaz web en tiempo real (SPA) que presenta métricas, predicciones y alertas a los usuarios autenticados.
- **Sistema_Auth**: Subsistema de autenticación y autorización basado en Amazon Cognito con User Pools, Identity Pools, MFA y roles definidos.
- **Sistema_Almacenamiento**: Subsistema de persistencia que incluye Amazon DynamoDB (métricas en tiempo real), Amazon Timestream (series temporales de telemetría), Amazon S3 (frames, video, datasets) y Amazon OpenSearch Serverless (búsqueda y vectores para RAG).
- **Sistema_Alertas**: Subsistema de eventos y notificaciones basado en Amazon EventBridge para activar alertas y triggers en tiempo real.
- **Sistema_API**: Capa de API basada en Amazon API Gateway (REST y WebSocket) y AWS Lambda para lógica de negocio.
- **Sistema_Observabilidad**: Subsistema de monitorización basado en Amazon CloudWatch y AWS X-Ray para logs, métricas y trazas distribuidas.
- **Frame**: Imagen individual extraída de un flujo de video de una cámara de F1.
- **Métrica_Rendimiento**: Valor numérico calculado a partir del análisis visual de un frame que representa un indicador de rendimiento (velocidad aparente, ángulo de dirección, posición en pista, intensidad de frenado, desgaste estimado de neumáticos).
- **Insight**: Texto en lenguaje natural generado por el Sistema_GenAI que describe una observación, recomendación o análisis sobre el rendimiento de un piloto o vehículo.
- **Ventana_Adelantamiento**: Periodo temporal identificado por el Sistema_Prediccion donde las condiciones son favorables para que un piloto realice un adelantamiento.
- **Anomalía_Rendimiento**: Desviación significativa detectada por el Sistema_Prediccion respecto al patrón de rendimiento esperado de un piloto o vehículo.
- **Rol_Admin**: Rol con acceso completo al sistema, gestión de usuarios y configuración.
- **Rol_Ingeniero_Pista**: Rol con acceso a métricas en tiempo real, recomendaciones de estrategia y alertas.
- **Rol_Analista**: Rol con acceso a datos históricos, análisis comparativo y generación de reportes.
- **Rol_Viewer**: Rol con acceso de solo lectura al dashboard.

## Requirements

### Requisito 1: Ingesta de Video en Tiempo Real

**Historia de Usuario:** Como Ingeniero de Pista, quiero que el sistema ingeste video en tiempo real desde las cámaras de los pilotos de F1, para poder analizar el rendimiento durante la carrera.

#### Criterios de Aceptación

1. WHEN una fuente de cámara de F1 inicia transmisión, THE Sistema_Ingestion SHALL establecer un flujo de ingesta a través de Amazon Kinesis Video Streams en un tiempo inferior a 5 segundos desde la detección del inicio de transmisión.
2. WHILE el flujo de video está activo, THE Sistema_Ingestion SHALL mantener la ingesta continua de frames con una pérdida no superior al 0.1% de los frames totales medida en ventanas consecutivas de 60 segundos.
3. WHEN se recibe un frame del flujo de video, THE Sistema_Ingestion SHALL publicar el frame en el stream de procesamiento con una latencia inferior a 200ms desde su recepción.
4. IF la fuente de cámara se desconecta inesperadamente, THEN THE Sistema_Ingestion SHALL registrar el evento de desconexión con marca temporal, notificar al equipo de operaciones y reintentar la conexión hasta 3 veces con backoff exponencial comenzando en 1 segundo con factor multiplicador de 2.
5. THE Sistema_Ingestion SHALL soportar la ingesta simultánea de al menos 20 flujos de video concurrentes (uno por piloto en parrilla) con una resolución mínima de 720p a 30 frames por segundo por flujo.
6. IF los 3 reintentos de reconexión a una fuente de cámara se agotan sin éxito, THEN THE Sistema_Ingestion SHALL marcar el flujo como inactivo, notificar al equipo de operaciones indicando la fuente afectada y cesar los intentos de reconexión automática hasta recibir una instrucción manual de reactivación.

### Requisito 2: Procesamiento Visual de Frames

**Historia de Usuario:** Como Ingeniero de Pista, quiero que cada frame sea procesado para detectar y segmentar objetos relevantes (coche, pista, sectores), para extraer información visual precisa.

#### Criterios de Aceptación

1. WHEN un frame es recibido del stream de ingesta, THE Sistema_Vision SHALL ejecutar detección de objetos y segmentación identificando al menos: vehículo del piloto, vehículos cercanos visibles en el frame, límites de pista y sectores.
2. WHEN el Sistema_Vision completa el análisis de un frame, THE Sistema_Vision SHALL producir un resultado estructurado con las coordenadas de bounding boxes, máscaras de segmentación y clasificaciones, incluyendo únicamente detecciones con una confianza mínima del 80% y descartando del resultado aquellas detecciones por debajo de dicho umbral.
3. THE Sistema_Vision SHALL procesar cada frame en un tiempo inferior a 500ms medidos desde la recepción del frame hasta la emisión del resultado estructurado.
4. IF el Sistema_Vision no puede procesar un frame por error de inferencia o por exceder el tiempo máximo de 500ms, THEN THE Sistema_Vision SHALL descartar el frame, registrar el error en logs y continuar procesando el siguiente frame sin interrupción del pipeline.
5. IF el Sistema_Vision descarta más de 10 frames consecutivos, THEN THE Sistema_Vision SHALL generar una alerta de degradación del servicio además de continuar el procesamiento.
6. WHILE la carga de procesamiento supera el 80% de capacidad del endpoint de inferencia, THE Sistema_Vision SHALL escalar horizontalmente los endpoints de SageMaker o contenedores de ECS/Fargate hasta un máximo de 10 instancias para mantener la latencia por debajo de 500ms por frame.

### Requisito 3: Extracción de Métricas Frame-a-Frame

**Historia de Usuario:** Como Ingeniero de Pista, quiero obtener métricas de rendimiento calculadas frame a frame con baja latencia, para tomar decisiones tácticas durante la carrera.

#### Criterios de Aceptación

1. WHEN el Sistema_Vision produce un resultado de análisis de frame, THE Sistema_Metricas SHALL calcular las siguientes métricas con las unidades y precisiones indicadas: velocidad aparente (km/h, resolución de 0.1 km/h), posición en línea de carrera (desviación lateral en metros, resolución de 0.01 m), intensidad de frenado (porcentaje de 0 a 100%), ángulo de dirección (grados, rango de -180 a +180, resolución de 0.1°) y desgaste estimado de neumáticos (porcentaje de degradación de 0 a 100%).
2. WHEN las métricas de un frame son calculadas, THE Sistema_Metricas SHALL persistir los valores en Amazon DynamoDB y Amazon Timestream con una latencia total de extracción inferior a 300ms (percentil 95) desde la recepción del resultado visual.
3. WHEN las métricas de posición en línea de carrera de un frame son calculadas, THE Sistema_Metricas SHALL calcular la desviación en metros de la línea de carrera del piloto respecto a la línea óptima teórica precargada en la configuración del circuito, con una resolución de al menos 10 puntos por curva.
4. IF un valor de métrica calculado está fuera de los rangos físicamente posibles definidos en la configuración del circuito para cada métrica, THEN THE Sistema_Metricas SHALL marcar el valor como anómalo, excluirlo del cálculo de promedios y registrar el evento con la métrica afectada y el valor recibido.
5. THE Sistema_Metricas SHALL mantener una latencia total end-to-end desde la captura del frame hasta la disponibilidad de la métrica en el almacenamiento inferior a 2 segundos en el percentil 99.
6. IF el Sistema_Vision no produce un resultado de análisis para un frame dentro de un período de 500ms desde la captura, THEN THE Sistema_Metricas SHALL descartar ese frame, incrementar un contador de frames perdidos y continuar el procesamiento con el siguiente frame disponible.
7. WHEN las métricas de un frame son calculadas, THE Sistema_Metricas SHALL asociar a cada registro persistido el identificador del frame de origen y la marca de tiempo de captura original para garantizar la trazabilidad temporal.

### Requisito 4: Generación de Insights con IA Generativa

**Historia de Usuario:** Como Ingeniero de Pista, quiero recibir análisis en lenguaje natural sobre el rendimiento del piloto y recomendaciones estratégicas generadas por IA, para complementar mi toma de decisiones.

#### Criterios de Aceptación

1. WHEN se acumulan métricas de un intervalo de 5 segundos para un piloto, THE Sistema_GenAI SHALL generar un insight en lenguaje natural en un máximo de 3 segundos que describa el rendimiento del piloto incluyendo al menos: ritmo de vuelta, degradación de neumáticos y comparación con el piloto inmediatamente adelante o detrás.
2. WHEN el Sistema_Prediccion identifica una Ventana_Adelantamiento, THE Sistema_GenAI SHALL generar una recomendación estratégica en lenguaje natural en un máximo de 2 segundos que incluya la ventana temporal estimada en segundos y el nivel de riesgo expresado en una escala categórica de tres niveles (bajo, medio, alto).
3. THE Sistema_GenAI SHALL utilizar Amazon Bedrock con contexto de reglas de F1 y datos históricos a través de Bedrock Knowledge Bases, e incluir en cada recomendación una referencia al contexto utilizado como fundamento.
4. WHEN se solicita un resumen de stint o sesión, THE Sistema_GenAI SHALL producir en un máximo de 10 segundos un resumen estructurado que incluya: ritmo promedio y variación por vuelta, tendencias de degradación identificadas, eventos con desviación superior al 5% respecto al promedio del stint, y recomendaciones para la siguiente fase.
5. IF el Sistema_GenAI no puede generar un insight dentro de un timeout de 5 segundos o por error del modelo, THEN THE Sistema_GenAI SHALL devolver un mensaje indicando indisponibilidad temporal y reintentar un máximo de 3 veces en los siguientes ciclos de generación antes de reportar fallo persistente.
6. IF el Sistema_GenAI agota los 3 reintentos sin generar el insight, THEN THE Sistema_GenAI SHALL registrar el fallo y notificar al Ingeniero de Pista que el insight no está disponible para el intervalo afectado, preservando la última respuesta válida generada.

### Requisito 5: Predicción de Estrategias y Anomalías

**Historia de Usuario:** Como Ingeniero de Pista, quiero que el sistema prediga estrategias óptimas de pit stop, gestión de neumáticos y detecte anomalías de rendimiento, para anticipar situaciones durante la carrera.

#### Criterios de Aceptación

1. WHILE una carrera está en curso, THE Sistema_Prediccion SHALL actualizar las predicciones de ventana de pit stop para cada piloto al menos cada 30 segundos, expresando cada ventana como un rango de vueltas (vuelta inicio – vuelta fin) calculado para minimizar el tiempo total de carrera según el modelo entrenado.
2. WHEN las métricas de desgaste de neumáticos de un piloto cruzan un umbral configurable, THE Sistema_Prediccion SHALL generar una predicción de vueltas restantes con neumático actual con un intervalo de confianza del 90%, expresado como rango numérico (mínimo – máximo vueltas).
3. WHEN el Sistema_Prediccion detecta una Anomalía_Rendimiento (desviación superior a 2 desviaciones estándar del patrón del piloto calculado sobre las últimas 10 vueltas completadas), THE Sistema_Prediccion SHALL generar una alerta con la clasificación de la anomalía (subviraje, sobreviraje, fatiga, degradación mecánica) en no más de 5 segundos desde la detección.
4. WHILE una carrera está en curso, THE Sistema_Prediccion SHALL identificar Ventanas_Adelantamiento al menos cada 15 segundos, basándose en la velocidad relativa entre pilotos (diferencia mínima de 0.3 segundos por sector), diferencias de desgaste de neumáticos y tipo de sector (recta, curva lenta, curva rápida).
5. IF los datos de entrada para una predicción están incompletos (menos del 70% de frames procesados en el intervalo), THEN THE Sistema_Prediccion SHALL marcar la predicción con un nivel de confianza numérico reducido (valor entre 0.0 y 1.0 donde valores por debajo de 0.5 indican baja confianza) y notificar al Sistema_Dashboard.
6. IF el Sistema_Prediccion no puede generar una predicción dentro de 10 segundos desde el inicio del ciclo de cálculo, THEN THE Sistema_Prediccion SHALL descartar el ciclo, mantener la última predicción válida vigente y registrar el evento notificando al Sistema_Dashboard con un indicador de predicción no disponible.

### Requisito 6: Dashboard en Tiempo Real

**Historia de Usuario:** Como Ingeniero de Pista, quiero visualizar métricas, predicciones y alertas en un dashboard web en tiempo real, para monitorizar el rendimiento del piloto durante la carrera.

#### Criterios de Aceptación

1. WHEN una nueva métrica es persistida en el almacenamiento, THE Sistema_Dashboard SHALL recibir la actualización a través de WebSocket API Gateway y renderizar el valor actualizado en menos de 500ms desde la persistencia.
2. THE Sistema_Dashboard SHALL presentar para cada piloto los siguientes datos en paneles individuales: velocidad aparente (en km/h), posición en línea de carrera (número ordinal), estado de neumáticos (compuesto, desgaste porcentual y vueltas de uso), predicción de pit stop (vuelta estimada), alertas activas (listado con clasificación y timestamp) e insights del Sistema_GenAI (texto de recomendación con timestamp de generación).
3. WHEN el Sistema_Alertas emite una alerta de Anomalía_Rendimiento, THE Sistema_Dashboard SHALL mostrar una notificación visual diferenciada del contenido circundante mediante color de alto contraste y posición fija en la parte superior del viewport, incluyendo la clasificación de la anomalía y el piloto afectado, en menos de 1 segundo desde la emisión, y la notificación SHALL permanecer visible hasta que el usuario la descarte manualmente.
4. THE Sistema_Dashboard SHALL permitir la visualización simultánea de hasta 20 pilotos con actualización en tiempo real manteniendo un frame rate mínimo de 30fps y un tiempo de renderizado por actualización de métrica inferior a 200ms.
5. WHILE el usuario tiene el dashboard activo, THE Sistema_Dashboard SHALL mantener la conexión WebSocket activa con reconexión automática en caso de desconexión, con un tiempo de reconexión inferior a 3 segundos y un máximo de 5 intentos consecutivos de reconexión.
6. IF la reconexión WebSocket falla tras 5 intentos consecutivos, THEN THE Sistema_Dashboard SHALL mostrar un indicador de estado de conexión perdida y un control manual para reintentar la conexión, conservando los últimos datos recibidos visibles en pantalla.
7. THE Sistema_Dashboard SHALL ser accesible desde navegadores Chrome, Firefox, Safari y Edge en sus 2 últimas versiones estables, y SHALL adaptar su layout sin pérdida de funcionalidad ni scroll horizontal para pantallas con un ancho mínimo de 1024px.
8. WHEN una métrica de un piloto no se actualiza durante más de 10 segundos, THE Sistema_Dashboard SHALL indicar visualmente que el dato está obsoleto diferenciándolo de los datos actualizados.

### Requisito 7: Autenticación y Autorización

**Historia de Usuario:** Como Administrador, quiero gestionar el acceso al sistema mediante autenticación segura y roles diferenciados, para controlar quién accede a cada funcionalidad.

#### Criterios de Aceptación

1. THE Sistema_Auth SHALL autenticar a los usuarios mediante Amazon Cognito User Pools con soporte para MFA obligatorio para los roles Rol_Admin y Rol_Ingeniero_Pista.
2. WHEN un usuario se autentica exitosamente, THE Sistema_Auth SHALL emitir tokens JWT con claims que incluyan el rol asignado y los permisos correspondientes, con un tiempo de expiración del token de acceso no mayor a 15 minutos y un tiempo de expiración del refresh token no mayor a 24 horas.
3. WHEN un usuario con Rol_Admin accede al sistema, THE Sistema_Auth SHALL permitir acceso completo a todas las funcionalidades incluyendo gestión de usuarios y configuración del sistema.
4. WHEN un usuario con Rol_Ingeniero_Pista accede al sistema, THE Sistema_Auth SHALL permitir acceso a métricas en tiempo real, recomendaciones de estrategia, alertas y datos del stint actual.
5. WHEN un usuario con Rol_Analista accede al sistema, THE Sistema_Auth SHALL permitir acceso a datos históricos, análisis comparativo, generación de reportes y exportación de datos.
6. WHEN un usuario con Rol_Viewer accede al sistema, THE Sistema_Auth SHALL permitir acceso de solo lectura al dashboard sin capacidad de modificar configuraciones ni exportar datos.
7. IF un usuario intenta acceder a un recurso sin los permisos requeridos por su rol, THEN THE Sistema_Auth SHALL denegar el acceso y registrar el intento en los logs de auditoría incluyendo como mínimo: identificador del usuario, recurso solicitado, marca de tiempo y dirección IP de origen.
8. WHEN un token JWT de acceso expira durante una sesión activa, THE Sistema_Auth SHALL renovar el token automáticamente mediante refresh tokens sin interrumpir la experiencia del usuario, siempre que el refresh token no haya expirado.
9. IF el refresh token ha expirado o ha sido revocado, THEN THE Sistema_Auth SHALL redirigir al usuario a la pantalla de inicio de sesión dentro de los 2 segundos siguientes a la detección de la expiración, sin pérdida de datos no guardados en el cliente.
10. IF un usuario falla la autenticación 5 veces consecutivas en un período de 10 minutos, THEN THE Sistema_Auth SHALL bloquear temporalmente la cuenta durante 30 minutos y notificar al usuario mediante un mensaje indicando el bloqueo temporal y el tiempo restante para reintento.
11. IF un usuario con MFA obligatorio falla la verificación del segundo factor 3 veces consecutivas, THEN THE Sistema_Auth SHALL bloquear el intento de inicio de sesión durante 15 minutos y registrar el evento en los logs de auditoría.

### Requisito 8: Persistencia de Métricas Históricas

**Historia de Usuario:** Como Analista, quiero acceder a métricas históricas de carreras anteriores, para realizar análisis comparativos y estudiar tendencias de rendimiento.

#### Criterios de Aceptación

1. WHEN las métricas de una sesión de carrera son generadas, THE Sistema_Almacenamiento SHALL persistir las métricas en Amazon Timestream con una retención configurable entre 365 días y 2555 días (7 años) en almacenamiento magnético, completando la operación de escritura en un máximo de 10 segundos tras la generación.
2. THE Sistema_Almacenamiento SHALL almacenar frames procesados y datasets en Amazon S3 con políticas de ciclo de vida que muevan datos a S3 Glacier después de 90 días sin operaciones de lectura sobre el objeto.
3. WHEN un Analista solicita datos históricos de un piloto o circuito, THE Sistema_Almacenamiento SHALL retornar los datos solicitados con una latencia inferior a 5 segundos para consultas que abarquen hasta 1 temporada completa (máximo 24 carreras), y con una latencia inferior a 15 segundos para consultas que abarquen hasta 5 temporadas.
4. THE Sistema_Almacenamiento SHALL indexar métricas históricas en Amazon OpenSearch Serverless para permitir búsquedas por piloto, circuito, fecha, tipo de métrica y rango de valores, con una latencia máxima de indexación de 60 segundos entre la persistencia del dato y su disponibilidad en búsqueda.
5. IF un dato histórico solicitado se encuentra en almacenamiento frío (S3 Glacier), THEN THE Sistema_Almacenamiento SHALL notificar al usuario del tiempo estimado de restauración en horas y ofrecer iniciar el proceso de recuperación, indicando la clase de recuperación disponible (estándar o masiva).
6. IF la persistencia de métricas en Amazon Timestream falla, THEN THE Sistema_Almacenamiento SHALL reintentar la operación hasta 3 veces con intervalos de 5 segundos, y si todos los reintentos fallan, SHALL almacenar las métricas en una cola de mensajes muertos y notificar al Analista con un mensaje indicando la falla de persistencia y el identificador de la sesión afectada.

### Requisito 9: Sistema de Alertas y Eventos

**Historia de Usuario:** Como Ingeniero de Pista, quiero recibir alertas en tiempo real cuando se detecten anomalías, cambios de estrategia recomendados o situaciones críticas, para reaccionar inmediatamente.

#### Criterios de Aceptación

1. WHEN el Sistema_Prediccion genera una alerta de Anomalía_Rendimiento, THE Sistema_Alertas SHALL publicar un evento en Amazon EventBridge y distribuirlo al Sistema_Dashboard y al Sistema_API en menos de 500ms desde la generación del evento.
2. WHEN el Sistema_Prediccion identifica una ventana óptima de pit stop inminente (menos de 3 vueltas), THE Sistema_Alertas SHALL emitir una alerta de prioridad alta al Ingeniero de Pista asignado al piloto correspondiente en menos de 500ms desde la detección.
3. THE Sistema_Alertas SHALL clasificar cada alerta en exactamente uno de los siguientes niveles de severidad: crítica, alta, media o informativa, y entregar las alertas críticas y altas en menos de 500ms, las de nivel medio en menos de 2 segundos, y las informativas en menos de 5 segundos.
4. WHEN se recibe una alerta de nivel crítica o alta, THE Sistema_Alertas SHALL presentar una notificación audible en el Sistema_Dashboard del Ingeniero de Pista asignado al piloto afectado.
5. WHEN se emiten más de 10 alertas del mismo tipo en un periodo de 60 segundos para un mismo piloto, THE Sistema_Alertas SHALL agrupar las alertas en un único evento consolidado que incluya el tipo de alerta, el número total de ocurrencias agrupadas, la marca de tiempo de la primera y última ocurrencia, y el identificador del piloto.
6. IF el Sistema_Alertas no puede entregar una alerta al destinatario después de 3 reintentos con un intervalo de 2 segundos entre cada reintento, THEN THE Sistema_Alertas SHALL registrar la falla de entrega indicando el destinatario, el tipo de alerta y la marca de tiempo, y escalar la alerta al Rol_Admin en menos de 5 segundos desde el último reintento fallido.

### Requisito 10: Seguridad y Cifrado

**Historia de Usuario:** Como Administrador, quiero que toda la información del sistema esté protegida con cifrado y controles de acceso estrictos, para garantizar la confidencialidad de los datos de telemetría.

#### Criterios de Aceptación

1. THE Sistema_API SHALL cifrar todas las comunicaciones en tránsito utilizando TLS 1.2 o superior en todos los endpoints, rechazando cualquier conexión que utilice una versión inferior de TLS.
2. THE Sistema_Almacenamiento SHALL cifrar todos los datos en reposo utilizando AWS KMS con claves gestionadas por el cliente (CMK) con rotación automática configurada cada 365 días.
3. THE Sistema_API SHALL estar protegido por AWS WAF con reglas que bloqueen ataques OWASP Top 10 incluyendo inyección SQL, XSS y CSRF, limitando a un máximo de 2000 solicitudes por minuto por IP.
4. THE Sistema_Auth SHALL almacenar todos los secretos y credenciales de servicio en AWS Secrets Manager con rotación automática configurada cada 90 días.
5. WHEN se despliega una política IAM, THE Sistema_Observabilidad SHALL verificar dentro de los 60 segundos posteriores al despliegue que la política no contiene wildcards (*) en acciones o recursos de producción y que cada política otorga permisos únicamente a los recursos explícitamente requeridos por el servicio asociado.
6. IF la verificación de una política IAM detecta wildcards o permisos excesivos, THEN THE Sistema_Observabilidad SHALL bloquear el despliegue de la política, revertir al estado anterior y notificar al Rol_Admin dentro de los 2 minutos siguientes a la detección.
7. IF se detectan 3 intentos de autenticación fallidos consecutivos desde la misma IP en un período de 5 minutos, THEN THE Sistema_Auth SHALL bloquear la IP durante 15 minutos, registrar el evento en el log de auditoría y notificar al Rol_Admin dentro de 1 minuto posterior al bloqueo.
8. IF falla la rotación automática de una CMK o de un secreto en AWS Secrets Manager, THEN THE Sistema_Observabilidad SHALL generar una alerta de severidad crítica y notificar al Rol_Admin dentro de los 5 minutos siguientes al fallo, manteniendo operativo el cifrado con la clave vigente hasta que se resuelva el problema.

### Requisito 11: Observabilidad y Monitorización

**Historia de Usuario:** Como Administrador, quiero monitorizar el estado del sistema con logs, métricas y trazas distribuidas, para detectar y resolver problemas operativos rápidamente.

#### Criterios de Aceptación

1. THE Sistema_Observabilidad SHALL recopilar logs estructurados de todos los componentes del sistema en Amazon CloudWatch Logs con un formato JSON estandarizado que incluya timestamp, nivel, servicio, traceId y mensaje, con un periodo de retención de 30 días y un tamaño máximo de entrada de log de 256 KB.
2. THE Sistema_Observabilidad SHALL instrumentar todas las invocaciones de Lambda y llamadas entre servicios con AWS X-Ray con una tasa de muestreo del 100%, proporcionando trazas distribuidas que cubran desde la recepción del frame en el punto de ingesta hasta la entrega del resultado al cliente vía WebSocket.
3. WHEN la latencia end-to-end de procesamiento de un frame supera los 2 segundos medida como percentil p99 en una ventana de 1 minuto, THE Sistema_Observabilidad SHALL generar una alarma en CloudWatch y enviar una notificación al equipo de operaciones a través de un tema SNS en un plazo máximo de 60 segundos desde la detección de la condición.
4. THE Sistema_Observabilidad SHALL publicar métricas personalizadas en CloudWatch con una granularidad de 1 segundo incluyendo: frames procesados por segundo, latencia de inferencia en milisegundos, tasa de errores de predicción como porcentaje y número de conexiones WebSocket activas.
5. WHEN un componente del sistema reporta una tasa de error superior al 5% en un periodo de evaluación de 5 minutos, THE Sistema_Observabilidad SHALL activar una alarma en CloudWatch y ejecutar acciones de remediación automática configuradas (reinicio de contenedores, escalado de endpoints) con un máximo de 3 intentos de remediación por incidente y un periodo de espera de 2 minutos entre intentos.
6. IF las acciones de remediación automática no resuelven la condición de error tras agotar los 3 intentos permitidos, THEN THE Sistema_Observabilidad SHALL escalar la alarma a severidad crítica y notificar al equipo de operaciones a través del tema SNS indicando el componente afectado, la tasa de error observada y las acciones de remediación ejecutadas.

### Requisito 12: Escalabilidad y Arquitectura Serverless

**Historia de Usuario:** Como Administrador, quiero que el sistema escale automáticamente según la demanda y minimice costos cuando no hay carga, para optimizar el uso de recursos.

#### Criterios de Aceptación

1. THE Sistema_API SHALL utilizar arquitectura serverless (AWS Lambda y API Gateway) para la lógica de negocio, escalando automáticamente de 0 hasta un máximo de 1000 invocaciones concurrentes sin intervención manual.
2. WHILE no hay carreras activas, THE Sistema_Ingestion SHALL reducir los recursos provisionados a 0 instancias de cómputo activas dentro de los 10 minutos posteriores al fin de la última carrera.
3. WHEN la utilización de los endpoints de inferencia supera el 70% de su capacidad durante una carrera, THE Sistema_Vision SHALL escalar los endpoints de inferencia (SageMaker o ECS/Fargate) en menos de 120 segundos hasta soportar el procesamiento simultáneo de 20 streams de video concurrentes.
4. THE Sistema_Almacenamiento SHALL aplicar políticas de ciclo de vida en S3 que muevan datos no accedidos durante 30 días a Intelligent-Tiering, y datos no accedidos durante 90 días a Glacier.
5. THE Sistema_API SHALL soportar al menos 1000 conexiones WebSocket concurrentes para el dashboard manteniendo una latencia de respuesta ≤ 100ms en el percentil 95.
6. IF el escalado de los endpoints de inferencia falla o excede los 120 segundos, THEN THE Sistema_Vision SHALL generar una alerta al Administrador e intentar escalar utilizando una estrategia alternativa dentro de los siguientes 60 segundos.

### Requisito 13: Infraestructura como Código

**Historia de Usuario:** Como Administrador, quiero que toda la infraestructura esté definida como código reproducible, para garantizar despliegues consistentes y auditables.

#### Criterios de Aceptación

1. THE Sistema_Observabilidad SHALL definir toda la infraestructura AWS (cómputo, redes, almacenamiento, permisos y servicios gestionados) utilizando AWS CDK con TypeScript como lenguaje de implementación.
2. WHEN se fusiona un cambio de infraestructura en la rama correspondiente al entorno destino según GitFlow, THE Sistema_Observabilidad SHALL desplegar el cambio de forma automatizada a través del pipeline de GitHub Actions sin pasos manuales de ejecución, completando el despliegue en un máximo de 30 minutos.
3. THE Sistema_Observabilidad SHALL mantener ambientes separados (desarrollo, staging, producción) con configuraciones parametrizadas mediante AWS CDK context y variables de entorno, donde cada ambiente utilice cuentas AWS o stacks aislados que impidan la modificación cruzada de recursos entre ambientes.
4. WHEN se ejecuta un despliegue, THE Sistema_Observabilidad SHALL ejecutar validaciones de seguridad (cdk-nag) y tests de síntesis de stacks antes de aplicar cambios en producción.
5. IF las validaciones de seguridad (cdk-nag) o los tests de infraestructura fallan durante el pipeline, THEN THE Sistema_Observabilidad SHALL bloquear el despliegue a producción, mantener el estado actual de la infraestructura sin cambios y registrar el fallo en el resultado del pipeline de GitHub Actions.
6. THE Sistema_Observabilidad SHALL almacenar el estado de la infraestructura en CloudFormation y mantener versionado el código CDK en el repositorio Git con el flujo GitFlow.
7. IF un despliegue a producción falla durante la ejecución de CloudFormation, THEN THE Sistema_Observabilidad SHALL ejecutar un rollback automático al último estado estable del stack y notificar el fallo en el resultado del pipeline de GitHub Actions.
