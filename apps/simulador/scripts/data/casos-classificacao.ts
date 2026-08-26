/**
 * Conjunto dourado de classificação — mede o alvo de ≥85% do PRD.
 *
 * `posicao` é o alvo de 4 dígitos que a RECUPERAÇÃO precisa acertar. A escolha
 * do item de 8 dígitos depende de atributos técnicos que só a desambiguação
 * resolve, então separar as duas coisas é proposital: assim dá para saber se
 * uma falha foi de recuperação (o candidato nunca esteve na lista) ou de
 * ranqueamento (estava, e o modelo escolheu errado).
 */

export interface CasoClassificacao {
  descricao: string;
  posicao: string; // 4 dígitos
  /** Item esperado quando a descrição já traz os atributos discriminantes. */
  ncm?: string;
  nota?: string;
}

export const CASOS: CasoClassificacao[] = [
  {
    descricao: "robô aspirador de pó, motor de 60 W, reservatório de 0,6 litro",
    posicao: "8508",
    ncm: "85081100",
    nota: "caso que a Fase 1 errava — a IA sugeria 8509.40.00 (liquidificadores)",
  },
  { descricao: "notebook para trabalho, 16GB de memória", posicao: "8471" },
  { descricao: "smartphone android com 128gb de armazenamento", posicao: "8517" },
  { descricao: "fone de ouvido bluetooth sem fio", posicao: "8518" },
  { descricao: "cabo USB-C de nylon trançado para carregar celular, 2 metros", posicao: "8544" },
  { descricao: "camiseta de malha de algodão masculina", posicao: "6109" },
  { descricao: "tênis esportivo para corrida com sola de borracha", posicao: "6404" },
  { descricao: "mochila de nylon para transportar notebook", posicao: "4202" },
  { descricao: "boneca de plástico para criança", posicao: "9503" },
  { descricao: "perfume feminino importado, extrato", posicao: "3303" },
  { descricao: "protetor solar facial em creme", posicao: "3304" },
  { descricao: "rolamento de esferas para eixo de motor", posicao: "8482" },
  { descricao: "válvula reguladora de pressão de metal", posicao: "8481" },
  { descricao: "geladeira frost free de 400 litros", posicao: "8418" },
  { descricao: "ar condicionado split de 12000 btus", posicao: "8415" },
  { descricao: "forno de micro-ondas de 30 litros", posicao: "8516" },
  { descricao: "airfryer, fritadeira elétrica sem óleo", posicao: "8516" },
  { descricao: "liquidificador doméstico de cozinha", posicao: "8509" },
  { descricao: "monitor de computador de 24 polegadas", posicao: "8528" },
  { descricao: "pendrive de 64gb usb", posicao: "8523" },
  { descricao: "power bank, carregador portátil de 10000mah", posicao: "8507" },
  { descricao: "painel solar fotovoltaico para energia", posicao: "8541" },
  { descricao: "lâmpada led bulbo para iluminação residencial", posicao: "8539" },
  { descricao: "bicicleta aro 29 sem motor", posicao: "8712" },
  { descricao: "patinete elétrico com motor", posicao: "8711" },
  { descricao: "óculos de sol polarizado", posicao: "9004" },
  { descricao: "seringa descartável para uso médico", posicao: "9018" },
  { descricao: "furadeira elétrica manual", posicao: "8467" },
  { descricao: "pneu novo de borracha para automóvel", posicao: "4011" },
  { descricao: "motor elétrico trifásico industrial", posicao: "8501" },
  { descricao: "parafuso de aço inoxidável", posicao: "7318" },
  { descricao: "impressora multifuncional a jato de tinta", posicao: "8443" },
  { descricao: "teclado mecânico para computador", posicao: "8471" },
  { descricao: "câmera de segurança ip para vigilância", posicao: "8525" },
  { descricao: "colchão de espuma de casal", posicao: "9404" },
  { descricao: "panela de aço inoxidável para cozinha", posicao: "7323" },
  { descricao: "shampoo anticaspa para cabelo", posicao: "3305" },
  { descricao: "relógio de pulso masculino", posicao: "9102" },
  { descricao: "cadeira de escritório giratória", posicao: "9401" },
  { descricao: "bomba d'água centrífuga", posicao: "8413" },
];
