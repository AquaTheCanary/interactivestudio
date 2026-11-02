const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");
admin.initializeApp();
const db = admin.firestore();

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const AZURE_OPENAI_ENDPOINT = defineSecret("AZURE_OPENAI_ENDPOINT");
const AZURE_OPENAI_API_KEY = defineSecret("AZURE_OPENAI_API_KEY");
const AZURE_OPENAI_DEPLOYMENT = defineSecret("AZURE_OPENAI_DEPLOYMENT");

const FREE_DOMAINS = new Set(["gmail.com","googlemail.com","yahoo.com","yahoo.co.uk","ymail.com","hotmail.com","hotmail.co.uk","outlook.com","outlook.co.uk","live.com","live.co.uk","msn.com","icloud.com","me.com","mac.com","aol.com","mail.com","proton.me","protonmail.com","gmx.com","gmx.co.uk","yandex.com","hey.com","fastmail.com","pm.me","zoho.com"]);
const PAID = new Set(["pro","team","organisation","enterprise","company"]);
const ALLOWED_ORIGINS = new Set(["https://aquathecanary.github.io","https://interactivestudio.abrdns.com"]);

function cors(req,res){
  const origin=req.get("origin")||"";
  if(ALLOWED_ORIGINS.has(origin)){res.set("Access-Control-Allow-Origin",origin);res.set("Vary","Origin");}
  res.set("Access-Control-Allow-Headers","Authorization, Content-Type");
  res.set("Access-Control-Allow-Methods","POST, OPTIONS");
  if(req.method==="OPTIONS"){res.status(204).send("");return true;}
  return false;
}
async function authenticatedUser(req){
  const header=req.get("authorization")||"";
  if(!header.startsWith("Bearer ")) throw new Error("Sign in is required.");
  return admin.auth().verifyIdToken(header.slice(7));
}
function corporate(email){
  const parts=String(email||"").toLowerCase().split("@");
  return parts.length===2 && parts[0] && parts[1].includes(".") && !FREE_DOMAINS.has(parts[1]);
}
async function planFor(uid){
  const snap=await db.collection("userEntitlements").doc(uid).get();
  return String(snap.exists?snap.data().plan||"Basic":"Basic").toLowerCase();
}
function replyText(data){return data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"";}

exports.assertOrganisationAccess=onRequest(async(req,res)=>{
  if(cors(req,res)) return;
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed."});
  try{
    const user=await authenticatedUser(req);
    if(!user.email_verified) return res.status(403).json({error:"Verify your corporate email before continuing."});
    if(!corporate(user.email)) return res.status(403).json({error:"A corporate email domain is required for organisation access."});
    return res.json({ok:true,domain:user.email.split("@")[1]});
  }catch(e){return res.status(401).json({error:e.message||"Organisation verification failed."});}
});

exports.generateAI=onRequest({secrets:[GEMINI_API_KEY,OPENAI_API_KEY,ANTHROPIC_API_KEY,AZURE_OPENAI_ENDPOINT,AZURE_OPENAI_API_KEY,AZURE_OPENAI_DEPLOYMENT],timeoutSeconds:120,memory:"512MiB"},async(req,res)=>{
  if(cors(req,res)) return;
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed."});
  try{
    const user=await authenticatedUser(req);
    const model=String(req.body?.model||"gemini").toLowerCase();
    const prompt=String(req.body?.prompt||"").trim().slice(0,16000);
    if(!prompt) return res.status(400).json({error:"Enter a prompt."});
    if(!["gemini","copilot","chatgpt","claude"].includes(model)) return res.status(400).json({error:"Unknown AI model."});
    const plan=await planFor(user.uid);
    if(["chatgpt","claude"].includes(model)&&!PAID.has(plan)) return res.status(403).json({error:"Upgrade to Pro or above to use this model."});
    const system="You are Interactive Studio's creative presentation assistant. Help users plan, write and improve clear, accurate, engaging presentations. Be concise and practical.";
    let text="";
    if(model==="gemini"){
      const key=GEMINI_API_KEY.value();
      if(!key) return res.status(503).json({error:"Gemini is not configured. Set the GEMINI_API_KEY Firebase secret."});
      const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key="+encodeURIComponent(key),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0.7,maxOutputTokens:1800}})});
      const data=await response.json();if(!response.ok)throw new Error(data.error?.message||"Gemini request failed.");text=replyText(data);
    }else if(model==="copilot"){
      const endpoint=AZURE_OPENAI_ENDPOINT.value(),key=AZURE_OPENAI_API_KEY.value(),deployment=AZURE_OPENAI_DEPLOYMENT.value();
      if(!endpoint||!key||!deployment)return res.status(503).json({error:"Copilot Mini needs an Azure OpenAI endpoint, key and deployment configured in Firebase Secrets."});
      const url=endpoint.replace(/\/$/,"")+"/openai/deployments/"+encodeURIComponent(deployment)+"/chat/completions?api-version=2024-10-21";
      const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","api-key":key},body:JSON.stringify({messages:[{role:"system",content:system},{role:"user",content:prompt}],temperature:0.7,max_tokens:1800})});
      const data=await response.json();if(!response.ok)throw new Error(data.error?.message||"Azure OpenAI request failed.");text=data.choices?.[0]?.message?.content||"";
    }else if(model==="chatgpt"){
      const key=OPENAI_API_KEY.value();if(!key)return res.status(503).json({error:"OpenAI is not configured. Set the OPENAI_API_KEY Firebase secret."});
      const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({model:"gpt-4o",messages:[{role:"system",content:system},{role:"user",content:prompt}],temperature:0.7,max_tokens:1800})});
      const data=await response.json();if(!response.ok)throw new Error(data.error?.message||"OpenAI request failed.");text=data.choices?.[0]?.message?.content||"";
    }else{
      const key=ANTHROPIC_API_KEY.value();if(!key)return res.status(503).json({error:"Claude is not configured. Set the ANTHROPIC_API_KEY Firebase secret."});
      const response=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-3-5-sonnet-20241022",system,max_tokens:1800,messages:[{role:"user",content:prompt}]})});
      const data=await response.json();if(!response.ok)throw new Error(data.error?.message||"Anthropic request failed.");text=(data.content||[]).map(x=>x.text||"").join("\n");
    }
    if(!text) throw new Error("The AI provider returned an empty response.");
    return res.json({text,model,plan});
  }catch(e){console.error("AI request failed",e);return res.status(500).json({error:e.message||"AI request failed."});}
});
exports.getEntitlements=onRequest(async(req,res)=>{
  if(cors(req,res)) return;
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed."});
  try{
    const user=await authenticatedUser(req);
    const plan=await planFor(user.uid);
    return res.json({plan:plan.charAt(0).toUpperCase()+plan.slice(1)});
  }catch(e){return res.status(401).json({error:e.message||"Could not load account entitlements."});}
});
