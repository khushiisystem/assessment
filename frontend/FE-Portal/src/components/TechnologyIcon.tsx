import React, { useState } from "react";
import { Icon } from "@iconify/react";

type TechnologyIconProps = {
  name?: string;
  profile?: string;
  iconUrl?: string;
  iconKey?: string;
  size?: number | string;
  className?: string;
  /** When no brand logo matches, render a branded letter monogram instead of a generic question mark. */
  fallbackMonogram?: boolean;
};


const resolveTechFromProfile = (profile?: string): string => {
  if (!profile) return "help";

  const p = profile.toLowerCase();
  // ===== MERN =====
  if (
    p.includes("mern") ||
    p.includes("full stack developer") ||
    p.includes("full stack") ||
    p.includes("mernstack") ||
    (p.includes("mongodb") && p.includes("react") && p.includes("node"))
  ) return "mongodb";

  // ===== AI / ML / GenAI =====
  if (
    p.includes("genai") ||
    p.includes("generative ai") ||
    p.includes("llm") ||
    p.includes("large language model")
  ) return "genai";


  if (
    p.includes("machine learning") ||
    p.includes("ml") ||
    p.includes("deep learning")||
    p.includes("ai_ml") ||
    p.includes("ai/ml") ||
    p.includes("aiml")
  ) return "ml";

  if (
  p === "ai/ml" ||
  p.includes("ai ml") ||
  p.includes("ai-ml") ||
  p.includes("aiml")
) return "aiml";

  if (
    p.includes("ai") ||
    p.includes("artificial intelligence")
  ) return "ai";

  if (
    p.includes("python developer") ||
    p.includes("python")
  ) return "python";


  // ===== Backend =====
  if (p.includes("java")) return "java";
  if (p.includes("spring")) return "spring";
  if (p.includes("node")) return "node";
  if (p.includes("express")) return "express";
  if (p.includes("django")) return "django";
  if (p.includes("fastapi")) return "fastapi";
  if (p.includes("flask")) return "flask";
  if (p.includes(".net") || p.includes("c#")) return "dotnet";
    if (p.includes("Nestjs") || p.includes("nest")) return "nestjs";

  // ===== Frontend =====
  if (p.includes("react")) return "react";
  if (p.includes("front end")) return "react";
  if (p.includes("angular")) return "angular";
  if (p.includes("vue")) return "vue";
  if (p.includes("typescript")) return "typescript";
  if (p.includes("javascript")) return "javascript";
  if (p.includes("html") || p.includes("css")) return "css";
  


  // ===== Data =====
  if (p.includes("data engineer")) return "apache";
  if (p.includes("data scientist")) return "python";
  if (p.includes("data analyst")) return "mysql";
  if (p.includes("powerbi")) return "powerbi";

  // ===== Databases =====
  if (p.includes("mongodb")) return "mongodb";
  if (p.includes("postgres")) return "postgresql";
  if (p.includes("mysql")) return "mysql";
  if (p.includes("sql")) return "mysql";

  // ===== Cloud =====
  if (p.includes("aws")) return "aws";
  if (p.includes("azure")) return "azure";
  if (p.includes("gcp")) return "gcp";
  if (p.includes("Kafka")|| p.includes("kafka")) return "kafka";
  if (p.includes("Snowflake")|| p.includes("snowflake")) return "snowflake";
  if (p.includes("Spark")|| p.includes("spark")) return "spark";
  if (p.includes("Data Warehouse")|| p.includes("dataWarehouse")) return "dataWarehouse";
  if (p.includes("Pyspark")|| p.includes("pyspark")) return "pyspark";
  if (p.includes("advancesql")|| p.includes("advancedsql")) return "advancedSQL";





   

  // ===== DevOps =====
  if (p.includes("docker")) return "docker";
  if (p.includes("kubernetes") || p.includes("k8s")) return "kubernetes";
  if (p.includes("devops")) return "docker";

  return "help";
};


const colorfulIconMap: Record<string, string> = {
  react: "logos:react",
  vue: "logos:vue",
  angular: "logos:angular-icon",
  svelte: "logos:svelte-icon",
  nextjs: "logos:nextjs-icon",
  nuxt: "logos:nuxt-icon",
  gatsby: "logos:gatsby",
  remix: "logos:remix-icon",
  solid: "logos:solidjs-icon",
  preact: "logos:preact",
  ember: "logos:ember-tomster",

  // Languages
  javascript: "logos:javascript",
  typescript: "logos:typescript-icon",
  python: "logos:python",
  java: "logos:java",
  csharp: "logos:c-sharp",
  cpp: "logos:c-plusplus",
  go: "logos:go",
  rust: "logos:rust",
  php: "logos:php",
  ruby: "logos:ruby",
  kotlin: "logos:kotlin-icon",
  swift: "logos:swift",
  dart: "logos:dart",
  scala: "logos:scala",
  elixir: "logos:elixir",
  clojure: "logos:clojure",
  haskell: "logos:haskell-icon",
  lua: "logos:lua",
  perl: "logos:perl",
  r: "logos:r-lang",

  // Backend Frameworks
  node: "logos:nodejs-icon",
  nestjs: "logos:nestjs",
  express: "logos:express",
  fastify: "logos:fastify-icon",
  django: "vscode-icons:file-type-django",
  fastapi: "logos:fastapi",
  flask: "logos:flask",
  spring: "logos:spring-icon",
  dotnet: "logos:dotnet",
  laravel: "logos:laravel",
  rails: "logos:rails",
  phoenix: "logos:phoenix",
  springboot: "logos:spring-icon",


  // Databases
  mongodb: "logos:mongodb-icon",
  mysql: "logos:mysql-icon",
  postgresql: "logos:postgresql",
  redis: "logos:redis",
  sqlite: "logos:sqlite",
  mariadb: "logos:mariadb-icon",
  cassandra: "logos:cassandra",
  couchdb: "logos:couchdb",
  dynamodb: "logos:aws-dynamodb",
  elasticsearch: "logos:elasticsearch",
  oracle: "logos:oracle",
  sqlserver: "logos:microsoft-sql-server",
  neo4j: "logos:neo4j",
  spark: "logos:apache-spark",       
  pyspark: "logos:python",          
  dataWarehouse: "mdi:database",     
  advancedSQL: "mdi:database-cog",



  // Cloud Providers
  aws: "logos:aws",
  awss3: "logos:aws-s3",
  lambda: "logos:aws-lambda",
  ec2: "logos:aws-ec2",
  git: "logos:git-icon",
  snowflake: "logos:snowflake-icon",
  kafka: "logos:kafka-icon",
  redshift: "logos:aws-redshift",
  azure: "logos:azure-icon",
  gcp: "logos:google-cloud",
  digitalocean: "logos:digitalocean",
  heroku: "logos:heroku-icon",
  vercel: "logos:vercel-icon",
  netlify: "logos:netlify",
  cloudflare: "logos:cloudflare-icon",
  firebase: "logos:firebase",
  supabase: "logos:supabase-icon",
  railway: "logos:railway-icon",
  render: "logos:render",


  // DevOps & Tools
  docker: "logos:docker-icon",
  kubernetes: "logos:kubernetes",
  jenkins: "logos:jenkins",
  gitlab: "logos:gitlab",
  github: "logos:github-icon",
  bitbucket: "logos:bitbucket",
  terraform: "logos:terraform-icon",
  ansible: "logos:ansible",
  vagrant: "logos:vagrant-icon",
  circleci: "logos:circleci",
  travis: "logos:travis-ci",
  githubactions: "logos:github-actions",

  // Testing
  jest: "logos:jest",
  mocha: "logos:mocha",
  cypress: "logos:cypress-icon",
  playwright: "logos:playwright",
  selenium: "logos:selenium",
  junit: "logos:junit",
  pytest: "logos:pytest",

  // Build Tools & Package Managers
  webpack: "logos:webpack",
  vite: "logos:vitejs",
  rollup: "logos:rollup",
  parcel: "logos:parcel-icon",
  npm: "logos:npm-icon",
  yarn: "logos:yarn",
  pnpm: "logos:pnpm",
  gradle: "logos:gradle",
  maven: "logos:maven",

  // CSS & Styling
  css: "logos:css-3",
  sass: "logos:sass",
  tailwind: "logos:tailwindcss-icon",
  bootstrap: "logos:bootstrap",
  materialui: "logos:material-ui",
  styledcomponents: "logos:styled-components",
  less: "logos:less",

  // Mobile Development
  reactnative: "logos:react",
  flutter: "logos:flutter",
  ionic: "logos:ionic-icon",
  cordova: "logos:cordova",
  xamarin: "logos:xamarin",

  // APIs & Communication
  graphql: "logos:graphql",
  rest: "logos:rest",
  grpc: "logos:grpc",
  apollo: "logos:apollographql",
  swagger: "logos:swagger",
  postman: "logos:postman-icon",

  // Monitoring & Analytics
  prometheus: "logos:prometheus",
  grafana: "logos:grafana",
  datadog: "logos:datadog",
  newrelic: "logos:new-relic",
  sentry: "logos:sentry-icon",

  // Message Queues & Streaming
  rabbitmq: "logos:rabbitmq-icon",

  // CMS & E-commerce
  wordpress: "logos:wordpress-icon",
  contentful: "logos:contentful",
  strapi: "logos:strapi-icon",
  shopify: "logos:shopify",
  woocommerce: "logos:woocommerce",

  // Version Control & Collaboration
  svn: "logos:subversion",

  // IDEs & Editors
  vscode: "logos:visual-studio-code",
  vim: "logos:vim",
  intellij: "logos:intellij-idea",
  webstorm: "logos:webstorm",
  sublime: "logos:sublime-text",
  atom: "logos:atom-icon",
  s3: "mdi:database",
  rds: "mdi:database-cog",
  // dynamodb: "mdi:database-outline",
  cloudfront: "mdi:cloud",
  route53: "mdi:map-marker-path",
  apigateway: "mdi:api",
  sqs: "mdi:message-processing",
  sns: "mdi:bell-ring",
  iam: "mdi:account-key",
  cognito: "mdi:account-group",
  eks: "mdi:kubernetes",
  ecs: "mdi:docker",
  fargate: "mdi:docker",
  cloudwatch: "mdi:chart-line",
  cloudformation: "mdi:file-tree",
  secretsmanager: "mdi:key-lock",
  athena: "mdi:magnify",

  // Other
  linux: "logos:linux-tux",
  ubuntu: "logos:ubuntu",
  debian: "logos:debian",
  nginx: "logos:nginx",
  apache: "logos:apache",
  electron: "logos:electron",
  tauri: "logos:tauri",
  socketio: "logos:socket.io",
  threejs: "logos:threejs",
  unity: "logos:unity",
  unreal: "logos:unrealengine-icon",
  blender: "logos:blender",
  figma: "logos:figma",
  sketch: "logos:sketch",
  xd: "logos:adobe-xd",
  photoshop: "logos:adobe-photoshop",

  
  // ===== Data Visualization =====
  tableau: "logos:tableau-icon",
  powerbi: "logos:microsoft-power-bi",
  excel: "vscode-icons:file-type-excel",

  // ===== AI / ML =====
  ai: "mdi:brain",
  ml: "mdi:chart-scatter-plot",
  genai: "mdi:robot-outline",
  llm: "mdi:chat-processing-outline",
  aiml: "carbon:machine-learning",
  ai_ml: "carbon:machine-learning",
};

const aliasMap: Record<string, string> = {
  "reactjs": "react",
  "react js": "react",
  "react.js": "react",
  "nodejs": "node",
  "node js": "node",
  "node-js": "node",
  "node.js": "node",
  "next.js": "nextjs",
  "next js": "nextjs",
  "vuejs": "vue",
  "vue js": "vue",
  "vue.js": "vue",
  "angular js": "angular",
  "angularjs": "angular",
  "ts": "typescript",
  "type script": "typescript",
  "js": "javascript",
  "java script": "javascript",
  "c#": "dotnet",
  "c sharp": "csharp",
  "c++": "cpp",
  "nextjs": "nextjs",
  "nest js": "nestjs",
  "nestjs": "nestjs",
  "aws s3": "awss3",
  "s3": "awss3",
  "aws lambda": "lambda",
  "lambda": "lambda",
  "ec2": "ec2",
  "git": "git",
  "snowflake": "snowflake",
  "springboot": "springboot",
  "spring boot": "springboot",
  "redshift": "aws-redshift",
  "big data": "kafka",
  "aws redshift": "redshift",
  "kafka": "kafka",
  "datawarehouse": "dataWarehouse",
  "data warehouse": "dataWarehouse",
  "pyspark": "pyspark",
  "advancesql": "advancedSQL",
  "advanced sql": "advancedSQL",
  "ai/ml": "aiml",
  "ai-ml": "aiml",
  "ai ml": "aiml",
  "aiml": "aiml",
  "ai": "ai",
  "machine learning": "ml",
  "ml": "ml",
  "deep learning": "ml",
  "genai": "genai",
  "gen ai": "genai",
  "generative ai": "genai",
  "tableau": "tableau",
  "power bi": "powerbi",
  "powerbi": "powerbi",
  "excel": "excel",
  "mongo db": "mongodb",
  "mongo": "mongodb",
  "postgres": "postgresql",
  "react native": "reactnative",
  "tailwind css": "tailwind",
  "tailwindcss": "tailwind",
  "material ui": "materialui",
  "styled components": "styledcomponents",
  "socket.io": "socketio",
  "socket io": "socketio",
  "three.js": "threejs",
  "three js": "threejs",
  "github actions": "githubactions",
};

export const TechnologyIcon: React.FC<TechnologyIconProps> = ({
  name,
  profile,
  iconUrl,
  iconKey,
  size = 40,
  className,
  fallbackMonogram,
}) => {
  const [imgError, setImgError] = useState(false);
  // Priority 1: uploaded image from backend
if (iconUrl && !imgError) {
    const sizeNum = typeof size === 'number' ? size : parseInt(size as string, 10) || 40;
    return (
      <img
        src={iconUrl}
        alt={name || 'icon'}
        width={sizeNum}
        height={sizeNum}
        className={className}
        style={{ objectFit: 'contain', width: sizeNum, height: sizeNum }}
        onError={() => setImgError(true)}
      />
    );
  }

  // Priority 2: explicit Iconify icon key from backend
  if (iconKey) {
    return (
      <Icon
        icon={iconKey}
        width={size}
        height={size}
        className={className}
      />
    );
  }

  // Priority 3: name-based mapping (existing behaviour)
  const resolvedName = name || resolveTechFromProfile(profile);
  const normalized = resolvedName.trim().toLowerCase();
  // Also try with separators stripped (e.g. "React JS" → "reactjs", "AI_ML" → "aiml")
  const stripped = normalized.replace(/[\s_\-\.]+/g, '');
  const mappedKey = aliasMap[normalized] || aliasMap[stripped] || stripped;
  const matched = colorfulIconMap[mappedKey] || colorfulIconMap[normalized];

  // No brand logo → branded letter monogram (consistent, premium fallback)
  if (!matched && fallbackMonogram && resolvedName) {
    const sizeNum = typeof size === "number" ? size : parseInt(size as string, 10) || 40;
    const letter = resolvedName.trim().charAt(0).toUpperCase() || "?";
    return (
      <span
        className={className}
        style={{
          width: sizeNum,
          height: sizeNum,
          fontSize: Math.round(sizeNum * 0.5),
          fontWeight: 800,
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {letter}
      </span>
    );
  }

  return (
    <Icon
      icon={matched || "mdi:help-circle-outline"}
      width={size}
      height={size}
      className={className}
    />
  );
};
