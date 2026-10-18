#!/usr/bin/env bash
# Runbook pos-merge da branch melhorias.
# Uso (a partir da raiz ou via npm): npm run db:post-merge -w guardioes-api
# Nao rode contra producao sem confirmacao consciente do host.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${API_DIR}/../.." && pwd)"
BACKUPS_DIR="${REPO_ROOT}/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUPS_DIR}/pre-melhorias-${STAMP}.sql"
LOG_FILE="${BACKUPS_DIR}/post-merge-${STAMP}.log"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Erro: defina DATABASE_URL antes de rodar este script." >&2
  exit 1
fi

extract_db_host() {
  node -e '
    const raw = process.env.DATABASE_URL || "";
    try {
      const u = new URL(raw);
      process.stdout.write(u.host || "(host ausente)");
    } catch {
      process.stdout.write("(URL invalida)");
      process.exitCode = 1;
    }
  '
}

DB_HOST="$(extract_db_host)" || {
  echo "Erro: DATABASE_URL invalida." >&2
  exit 1
}

cd "${API_DIR}"
ORPHAN_JSON="$(npm run --silent db:check:orphans)"

echo "=============================================="
echo " Runbook pos-merge (melhorias)"
echo " Host do banco: ${DB_HOST}"
echo " Backup: ${BACKUP_FILE}"
echo " Log: ${LOG_FILE}"
echo " Orfaos (somente leitura, nada sera apagado):"
printf '%s\n' "${ORPHAN_JSON}"
echo "=============================================="
echo "Digite exatamente \"sim\" para continuar (qualquer outra coisa aborta):"
read -r CONFIRM || true
CONFIRM="$(printf '%s' "${CONFIRM}" | tr -d '\r\n')"
if [[ "${CONFIRM}" != "sim" ]]; then
  echo "Abortado: confirmacao diferente de \"sim\" (recebido: '${CONFIRM}')." >&2
  exit 1
fi

log() {
  local msg="$1"
  printf '%s %s\n' "$(date -Iseconds)" "${msg}" | tee -a "${LOG_FILE}"
}

mkdir -p "${BACKUPS_DIR}"
: > "${LOG_FILE}"
{
  echo "----- db:check:orphans -----"
  printf '%s\n' "${ORPHAN_JSON}"
} >> "${LOG_FILE}"
log "db:check:orphans registrado antes do backup"

run_step() {
  local step_name="$1"
  shift
  log "INICIO etapa: ${step_name}"
  {
    echo "----- ${step_name} -----"
    "$@"
  } >> "${LOG_FILE}" 2>&1 || {
    local code=$?
    log "FALHA na etapa: ${step_name} (exit ${code})"
    echo "Abortado na etapa \"${step_name}\"." >&2
    echo "Backup (se criado): ${BACKUP_FILE}" >&2
    echo "Log completo: ${LOG_FILE}" >&2
    exit "${code}"
  }
  log "OK etapa: ${step_name}"
}

log "Iniciando backup com pg_dump"
if ! pg_dump "${DATABASE_URL}" > "${BACKUP_FILE}" 2>> "${LOG_FILE}"; then
  log "FALHA: pg_dump"
  rm -f "${BACKUP_FILE}"
  echo "Abortado: backup falhou. Nada foi migrado." >&2
  echo "Log: ${LOG_FILE}" >&2
  exit 1
fi

if [[ ! -s "${BACKUP_FILE}" ]]; then
  log "FALHA: backup vazio"
  echo "Abortado: arquivo de backup vazio (${BACKUP_FILE})." >&2
  echo "Log: ${LOG_FILE}" >&2
  exit 1
fi

log "Backup OK ($(wc -c < "${BACKUP_FILE}" | tr -d ' ') bytes)"

cd "${API_DIR}"

run_step "db:deploy" npm run db:deploy
run_step "db:backfill:module-quiz" npm run db:backfill:module-quiz
run_step "db:backfill:training" npm run db:backfill:training
run_step "db:backfill:user-neighborhood-id" npm run db:backfill:user-neighborhood-id
run_step "db:reconcile:neighborhood" npm run db:reconcile:neighborhood

log "Pos-merge concluido com sucesso."
echo "Concluido. Backup: ${BACKUP_FILE}"
echo "Log: ${LOG_FILE}"
