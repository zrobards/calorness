// Every save the app makes from a screen, wrapped so a dropped connection
// returns { error } (shown on screen) instead of crashing the page and
// losing what you entered. Screens import saves from here, not from the
// actions files directly. Reads are left as they are.
import { safe } from "@/lib/safeAction";
import { addDiaryEntry as addDiaryEntryServer, addWater as addWaterServer, copyMealFromDay as copyMealFromDayServer, copyWholeDay as copyWholeDayServer, createCustomFood as createCustomFoodServer, deleteDiaryEntries as deleteDiaryEntriesServer, deleteDiaryEntry as deleteDiaryEntryServer, deleteSavedMeal as deleteSavedMealServer, logSavedMeal as logSavedMealServer, saveMealFromDay as saveMealFromDayServer, updateCustomFood as updateCustomFoodServer, updateDiaryEntry as updateDiaryEntryServer } from "@/app/(app)/diary/actions";
import { logAiItems as logAiItemsServer, quickRelog as quickRelogServer } from "@/app/(app)/log/actions";
import { createExercise as createExerciseServer, createProgram as createProgramServer, deleteExercise as deleteExerciseServer, deleteProgram as deleteProgramServer, deleteRoutine as deleteRoutineServer, deleteWorkout as deleteWorkoutServer, discardWorkout as discardWorkoutServer, finishWorkout as finishWorkoutServer, importTemplate as importTemplateServer, logBodyweight as logBodyweightServer, moveProgram as moveProgramServer, moveRoutine as moveRoutineServer, renameProgram as renameProgramServer, saveWorkoutEdits as saveWorkoutEditsServer, setActiveProgram as setActiveProgramServer, setRoutineProgram as setRoutineProgramServer, updateWorkoutTime as updateWorkoutTimeServer } from "@/app/(app)/train/actions";
import { deleteActivity as deleteActivityServer, logActivity as logActivityServer, saveBodyStats as saveBodyStatsServer, setExerciseCredit as setExerciseCreditServer, updateActivity as updateActivityServer } from "@/app/(app)/train/cardio/actions";
import { createApiKey as createApiKeyServer, deleteApiKey as deleteApiKeyServer, setActivityGoals as setActivityGoalsServer, updateTargets as updateTargetsServer, saveGoals as saveGoalsServer, deleteAccount as deleteAccountServer } from "@/app/(app)/profile/actions";
import { addMusic as addMusicServer, removeMusic as removeMusicServer } from "@/app/(app)/music/actions";
import { setPassword as setPasswordServer } from "@/app/signin/actions";
import { saveProgramDraft as saveProgramDraftServer } from "@/app/(app)/train/programs/actions";
import { applyProposal as applyProposalServer, deleteChat as deleteChatServer, forgetNote as forgetNoteServer, saveCoachProgram as saveCoachProgramServer } from "@/app/(app)/coach/actions";

type Fn = (...args: never[]) => Promise<unknown>;
const wrap = <F extends Fn>(fn: F, retries = 0) => ((...args: Parameters<F>) => safe(() => fn(...args) as ReturnType<F>, { retries })) as (...args: Parameters<F>) => Promise<Awaited<ReturnType<F>> | { error: string }>;

export const addDiaryEntry = wrap(addDiaryEntryServer);
export const addWater = wrap(addWaterServer);
export const copyMealFromDay = wrap(copyMealFromDayServer);
export const copyWholeDay = wrap(copyWholeDayServer);
export const createCustomFood = wrap(createCustomFoodServer);
export const deleteDiaryEntries = wrap(deleteDiaryEntriesServer);
export const deleteDiaryEntry = wrap(deleteDiaryEntryServer);
export const deleteSavedMeal = wrap(deleteSavedMealServer);
export const logSavedMeal = wrap(logSavedMealServer);
export const saveMealFromDay = wrap(saveMealFromDayServer);
export const updateCustomFood = wrap(updateCustomFoodServer);
export const updateDiaryEntry = wrap(updateDiaryEntryServer, 2);
export const logAiItems = wrap(logAiItemsServer);
export const quickRelog = wrap(quickRelogServer);
export const createExercise = wrap(createExerciseServer);
export const createProgram = wrap(createProgramServer);
export const deleteExercise = wrap(deleteExerciseServer);
export const deleteProgram = wrap(deleteProgramServer);
export const deleteRoutine = wrap(deleteRoutineServer);
export const deleteWorkout = wrap(deleteWorkoutServer);
export const discardWorkout = wrap(discardWorkoutServer);
export const finishWorkout = wrap(finishWorkoutServer);
export const importTemplate = wrap(importTemplateServer);
export const logBodyweight = wrap(logBodyweightServer);
export const moveProgram = wrap(moveProgramServer);
export const moveRoutine = wrap(moveRoutineServer);
export const renameProgram = wrap(renameProgramServer, 2);
export const saveWorkoutEdits = wrap(saveWorkoutEditsServer);
export const setActiveProgram = wrap(setActiveProgramServer, 2);
export const setRoutineProgram = wrap(setRoutineProgramServer);
export const updateWorkoutTime = wrap(updateWorkoutTimeServer, 2);
export const deleteActivity = wrap(deleteActivityServer);
export const logActivity = wrap(logActivityServer);
export const saveBodyStats = wrap(saveBodyStatsServer, 2);
export const setExerciseCredit = wrap(setExerciseCreditServer, 2);
export const updateActivity = wrap(updateActivityServer, 2);
export const createApiKey = wrap(createApiKeyServer);
export const deleteApiKey = wrap(deleteApiKeyServer);
export const setActivityGoals = wrap(setActivityGoalsServer, 2);
export const updateTargets = wrap(updateTargetsServer, 2);
export const saveGoals = wrap(saveGoalsServer);
export const deleteAccount = wrap(deleteAccountServer);
export const addMusic = wrap(addMusicServer);
export const removeMusic = wrap(removeMusicServer);
export const setPassword = wrap(setPasswordServer);
export const saveProgramDraft = wrap(saveProgramDraftServer);
export const applyProposal = wrap(applyProposalServer);
export const deleteChat = wrap(deleteChatServer);
export const forgetNote = wrap(forgetNoteServer);
export const saveCoachProgram = wrap(saveCoachProgramServer);
