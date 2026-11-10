const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
admin.initializeApp();

const FREE_DOMAINS = new Set(["gmail.com","googlemail.com","yahoo.com","yahoo.co.uk","ymail.com","hotmail.com","hotmail.co.uk","outlook.com","outlook.co.uk","live.com","live.co.uk","msn.com","icloud.com","me.com","mac.com","aol.com","mail.com","proton.me","protonmail.com","gmx.com","gmx.co.uk","yandex.com","hey.com","fastmail.com","pm.me","zoho.com"]);
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
