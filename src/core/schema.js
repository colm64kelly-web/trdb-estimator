export const MarketSchema = {
  required: ["version","currency","units","quality","options","slices"],
  validate(json){
    const missing = this.required.filter(k=>!(k in json));
    if(missing.length) throw new Error(`Market JSON missing keys: ${missing.join(', ')}`);
    if(!json.quality?.standard?.rate) throw new Error('quality.standard.rate is required');
    return true;
  }
};
