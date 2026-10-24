<?php
namespace sqhlib\Hanzi;
class HanziConvert
{
    private static $hanziDict;
    private static $hanziReverseDict;
    public static function convert($str, $isSc2tc = false)
    {
        if (empty($str)) {
            return $str;
        }
        self::initConvert($isSc2tc);
        $strArr = preg_split('/(?<!^)(?!$)/u', $str);
        array_walk($strArr, function (&$value) use ($isSc2tc) {
            if ($isSc2tc) {
                $value = isset(self::$hanziReverseDict[$value]) ? self::$hanziReverseDict[$value] : $value;
            } else {
                $value = isset(self::$hanziDict[$value]) ? self::$hanziDict[$value] : $value;
            }
        });
        return implode('', $strArr);
    }
    public static function initConvert($isSC2tc = false)
    {
        if ($isSC2tc) {
            if (empty(self::$hanziReverseDict)) {
                self::$hanziReverseDict = require('HanziDict.php');
                self::$hanziReverseDict = array_flip(self::$hanziReverseDict);
            }
        } else {
            if (empty(self::$hanziDict)) {
                self::$hanziDict = require('HanziDict.php');
            }
        }
    }

}