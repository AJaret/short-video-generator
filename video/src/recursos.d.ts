// Tipos de los archivos que webpack importa como URL.
declare module '*.woff2' {
  const url: string;
  export default url;
}
declare module '*.wav' {
  const url: string;
  export default url;
}
