import { Config } from "../types/schema";

let id = "DEFAULT";

export function getConfig(): Config {
  let config = Config.load(id);
  if (config == null) {
    config = new Config(id);
    config.save();
  }
  return config as Config;
}
