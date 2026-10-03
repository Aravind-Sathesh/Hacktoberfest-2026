// Metro resolves image imports to an asset id.
declare module '*.png' {
  const asset: number;
  export default asset;
}
