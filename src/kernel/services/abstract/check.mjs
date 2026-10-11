/** Live approval and evidence validation; public factories create their own adjacent Provider. */
export class CheckService {
  constructor() { if (new.target === CheckService) throw new TypeError("abstract_check_service"); }
  static assert(value) {
    if (!(value instanceof CheckService) || ["run", "close"].some((name) => typeof value[name] !== "function")) {
      throw new TypeError("invalid_check_service");
    }
    return value;
  }
}
