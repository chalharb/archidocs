export interface Io {
  log(message: string): void;
  error(message: string): void;
}

export const consoleIo: Io = {
  log: (message) => console.log(message),
  error: (message) => console.error(message),
};
