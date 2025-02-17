import {
  type RuleRequest,
  type RuleResult,
} from '@tazama-lf/frms-coe-lib/lib/interfaces';
import { decodeConditionsBuffer } from '@tazama-lf/frms-coe-lib/lib/helpers/protobuf';
import { CalculateDuration } from '@tazama-lf/frms-coe-lib/lib/helpers/calculatePrcg';
import { type ConditionDetails } from '@tazama-lf/frms-coe-lib/lib/interfaces/event-flow/ConditionDetails';
import { databaseManager, loggerService, server } from '.';
import { configuration } from './';

export const handleTransaction = async (req: unknown): Promise<void> => {
  const startTime = process.hrtime.bigint();
  const msg = req as RuleRequest;

  const request = {
    transaction: msg.transaction,
    networkMap: msg.networkMap,
    DataCache: msg.DataCache,
    metaData: msg.metaData,
  };

  let conditions = (
    await Promise.all([
      databaseManager._redisClient.getBuffer(
        `entities/${request.DataCache.cdtrId}`,
      ),
      databaseManager._redisClient.getBuffer(
        `entities/${request.DataCache.dbtrId}`,
      ),
      databaseManager._redisClient.getBuffer(
        `accounts/${request.DataCache.cdtrAcctId}`,
      ),
      databaseManager._redisClient.getBuffer(
        `accounts/${request.DataCache.dbtrAcctId}`,
      ),
    ])
  )
    .map((dec: Buffer) => {
      if (dec && dec.length > 0) {
        try {
          const decode = decodeConditionsBuffer(dec);
          return decode?.conditions;
        } catch (err) {
          loggerService.error('Could not decode a condition');
        }
      }
      return null;
    })
    .filter((x) => x)
    .flat();

  const transactionDate = new Date(
    request.transaction.FIToFIPmtSts.GrpHdr.CreDtTm,
  );

  // Filter in relevant dates
  conditions = conditions.filter((cond) => {
    return (
      (!cond!.xprtnDtTm || new Date(cond!.xprtnDtTm) > transactionDate) &&
      new Date(cond!.incptnDtTm) <= transactionDate
    );
  });

  // Filter out conditions not fit for transaction type
  conditions = conditions.filter((cond) =>
    cond?.prsptvs.some((p) => {
      return p.evtTp.some((evt) => {
        return evt === request.transaction.TxTp || evt === 'all';
      });
    }),
  );

  //Determine outcome and calculate duration
  const ruleResult = await determineOutcome(
    conditions as ConditionDetails[],
    request,
  );
  ruleResult.prcgTm = CalculateDuration(startTime);

  try {
    await server.handleResponse({ ...request, ruleResult });
  } catch (error) {
    const failMessage = 'Failed to send to Typology Processor.';
    loggerService.error(
      failMessage,
      error,
      `${configuration.RULE_NAME}@${configuration.RULE_VERSION}`,
      configuration.functionName,
    );
  }
};

export const determineOutcome = async (
  conditions: ConditionDetails[],
  request: object,
): Promise<RuleResult> => {
  const ruleResult: RuleResult = {
    id: `${configuration.RULE_NAME}@${configuration.RULE_VERSION}`,
    cfg: 'none',
    subRuleRef: 'none',
    prcgTm: 0,
  };

  if (
    conditions.some(
      (cond) =>
        cond.condTp === 'non-overridable-block' ||
        cond.condTp === 'overridable-block',
    )
  ) {
    ruleResult.subRuleRef = 'block';
  }

  if (
    conditions.some((cond) => cond.condTp === 'override') &&
    !conditions.some((cond) => cond.condTp === 'non-overridable-block')
  ) {
    ruleResult.subRuleRef = 'override';
  }

  if (!configuration.SUPPRESS_ALERTS && ruleResult.subRuleRef === 'block') {
    server
      .handleResponse({ ...request, ruleResult }, [
        configuration.INTERDICTION_PRODUCER,
      ])
      .catch((error) => {
        loggerService.error(
          `Error while sending Event Flow Rule Processor result to ${configuration.INTERDICTION_PRODUCER}`,
          error as Error,
          ruleResult.id,
          configuration.functionName,
        );
      });
  }

  return ruleResult;
};
