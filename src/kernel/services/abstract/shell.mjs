export class ShellService {
  constructor() { if(new.target===ShellService)throw new TypeError("abstract_shell_service"); }
  static assert(value) { if(!(value instanceof ShellService) || ["observeTime", "prepare","run","readCandidate","finishPublication","close"].some((name)=>typeof value[name]!=="function"))throw new TypeError("invalid_shell_service");return value; }
}
