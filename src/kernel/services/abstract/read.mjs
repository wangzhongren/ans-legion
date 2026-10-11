/** Safe project inspection contract. Authorization remains a separate host decision. */
export class ReadService {
  constructor() { if (new.target === ReadService) throw new TypeError("abstract_read_service"); }
  static assert(value) {
    if (!(value instanceof ReadService) || ["listFiles", "readFile", "close"].some((name) =>
      typeof value[name] !== "function")) throw new TypeError("invalid_read_service");
    return value;
  }
}
