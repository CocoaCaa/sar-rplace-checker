export interface OnPixelChanged {
  x: number;
  y: number;
  beforeColor: {
    r: number;
    g: number;
    b: number;
  };
  afterColor: {
    r: number;
    g: number;
    b: number;
  };
}
