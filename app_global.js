/*************************************************************
 * MOTOR GLOBAL - VERSÃO 5.0 - ESTRATÉGIA DE ECONOMIA
 *************************************************************/

const GEMINI_MODEL = "gemini-2.5-flash-lite"; 
let documentoReferencia = "";
let cliquesTitulo = 0;

window.onload = () => {
    const tituloH2 = document.getElementById("titulo-dinamico");
    const painelAdmin = document.getElementById("admin-panel");
    const inputChave = document.getElementById("api-key-input");

    if (tituloH2) {
        tituloH2.textContent = CONFIG_SISTEMA.titulo;
        tituloH2.onclick = () => {
            cliquesTitulo++;
            if (cliquesTitulo >= 3) {
                painelAdmin.style.display = painelAdmin.style.display === "none" ? "block" : "none";
                cliquesTitulo = 0;
            }
        };
    }

    const chaveSalva = localStorage.getItem("GEMINI_API_KEY");
    if (chaveSalva) inputChave.value = chaveSalva;

    setInterval(atualizarMonitorConsultas, 1000);
    carregarDocumento(CONFIG_SISTEMA.arquivoContexto);
};

function atualizarMonitorConsultas() {
    const agora = Date.now();
    const janelaUmMinuto = 60000;
    const elementoContador = document.getElementById("contador-minuto");
    let historico = JSON.parse(sessionStorage.getItem("timestamps_requisicoes") || "[]");
    historico = historico.filter(ts => (agora - ts) < janelaUmMinuto);
    sessionStorage.setItem("timestamps_requisicoes", JSON.stringify(historico));
    if (elementoContador) elementoContador.innerText = historico.length;
}

async function carregarDocumento(nomeArquivo) {
    const campoResposta = document.getElementById("resposta");
    campoResposta.textContent = "Carregando manual técnico...";
    try {
        const response = await fetch(nomeArquivo);
        documentoReferencia = await response.text();
        setTimeout(() => {
            campoResposta.textContent = "Sistema pronto.";
            // BOOT: Solicita as sugestões iniciais (isBoot = true)
            consultar("Com base no manual, sugira 3 perguntas curtas.", true);
        }, 2000);
    } catch (e) {
        campoResposta.textContent = "Erro ao carregar arquivo de contexto.";
    }
}

async function consultar(perguntaForcada = null, isBoot = false) {
    const chave = localStorage.getItem("GEMINI_API_KEY");
    const campoResposta = document.getElementById("resposta");
    const pergunta = perguntaForcada || document.getElementById("pergunta").value.trim();

    if (!chave || !pergunta || !documentoReferencia) return;

    // Medidor calibrado: registra antes do disparo
    if (!isBoot) {
        let hist = JSON.parse(sessionStorage.getItem("timestamps_requisicoes") || "[]");
        hist.push(Date.now());
        sessionStorage.setItem("timestamps_requisicoes", JSON.stringify(hist));
        atualizarMonitorConsultas();
    }

    const promptText = `Aja como assistente técnico. Use APENAS o manual.
PROTOCOLO: Resposta técnica em [RESPOSTA] e 3 perguntas curtas em [SUGESTOES] separadas por |.
MANUAL: ${documentoReferencia}
PERGUNTA: ${pergunta}`;

    try {
        const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${chave}`;
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
        });

        if (response.status === 429) {
            campoResposta.innerHTML = "<span style='color: #ff4d4d;'>Limite excedido (429). Aguarde 60s.</span>";
            return;
        }

        const data = await response.json();
        const fullText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

const partes = fullText.split(/\[SUGESTÕES\]|\[SUGESTOES\]/i);
        const respostaTecnica = partes[0].replace("[RESPOSTA]", "").trim();
        
        // Agora processamos sugestões SEMPRE que elas vierem na resposta
        const sugestoesRaw = partes[1] ? partes[1].split("|") : [];

        let htmlFinal = "";
        
        // 1. Mostra a resposta técnica (se não for o boot)
        if (!isBoot && respostaTecnica) {
            htmlFinal += `<div style="text-align: left; line-height: 1.5; margin-bottom: 20px;">${respostaTecnica}</div>`;
        }

        // 2. Mostra as sugestões (sempre que disponíveis)
        if (sugestoesRaw.length > 0) {
            htmlFinal += `<div class="sugestoes-container" style="border-top: 1px solid #444; padding-top: 10px; margin-top: 10px; text-align: left !important;">`;
            htmlFinal += `<span class="titulo-sugestoes" style="color: #4da3ff; font-weight: bold; text-decoration: underline; display: block; margin-bottom: 10px;">Sugestões de perguntas:</span>`;
            
            sugestoesRaw.forEach(s => {
                const sug = s.trim();
                if(sug && sug.length > 5) {
                    htmlFinal += `<div class="sugestao-simples" style="color: white; margin: 5px 0; text-align: left !important;">> ${sug}</div>`;
                }
            });
            htmlFinal += `</div>`;
        }
        
        campoResposta.innerHTML = htmlFinal;
        
        campoResposta.innerHTML = htmlFinal;

    } catch (e) {
        campoResposta.textContent = "Erro na conexão com a API.";
    }
}

function salvarChaveLocal() {
    localStorage.setItem("GEMINI_API_KEY", document.getElementById("api-key-input").value.trim());
    alert("Chave salva!");
    document.getElementById("admin-panel").style.display = "none";
}